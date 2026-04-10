const path = require("path");
const express = require("express");
const mariadb = require("mariadb");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const dotenv = require("dotenv");
const cors = require("cors");

dotenv.config();

const app = express();

app.use(cors());
app.use(express.json());
app.use(express.static("public"));

app.get("/home-finder", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "home-finder.html"));
});

app.get("/home-finder.js", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "home-finder.js"));
});

const pool = mariadb.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASS,
  database: process.env.DB_NAME,
  connectionLimit: 5,
});

async function ensureSchema() {
  let conn;
  try {
    conn = await pool.getConnection();

    try {
      await conn.query(
        "ALTER TABLE Records ADD COLUMN view_count INT NOT NULL DEFAULT 0",
      );
    } catch (err) {
      if (!["ER_DUP_FIELDNAME", "ER_BAD_FIELD_ERROR"].includes(err.code)) {
        throw err;
      }
    }

    await conn.query(`
      CREATE TABLE IF NOT EXISTS Comments (
        id INT AUTO_INCREMENT PRIMARY KEY,
        record_id INT NOT NULL,
        user_id INT NOT NULL,
        content TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT fk_comments_record
          FOREIGN KEY (record_id) REFERENCES Records(id)
          ON DELETE CASCADE,
        CONSTRAINT fk_comments_user
          FOREIGN KEY (user_id) REFERENCES Users(id)
          ON DELETE CASCADE
      )
    `);
  } finally {
    if (conn) conn.release();
  }
}

function authenticateToken(req, res, next) {
  const authHeader = req.headers.authorization;
  const token = authHeader && authHeader.split(" ")[1];

  if (!token) {
    return res.status(401).json({ message: "로그인이 필요합니다." });
  }

  jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ message: "토큰이 유효하지 않습니다." });
    }

    req.user = user;
    next();
  });
}

function normalizeBigInts(value) {
  if (typeof value === "bigint") {
    return Number(value);
  }

  if (Array.isArray(value)) {
    return value.map(normalizeBigInts);
  }

  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, nestedValue]) => [
        key,
        normalizeBigInts(nestedValue),
      ]),
    );
  }

  return value;
}

async function fetchComments(conn, recordId) {
  const rows = await conn.query(
    `
      SELECT
        c.id,
        c.record_id,
        c.user_id,
        c.content,
        c.created_at,
        u.name AS author_name
      FROM Comments c
      JOIN Users u ON u.id = c.user_id
      WHERE c.record_id = ?
      ORDER BY c.created_at ASC
    `,
    [recordId],
  );

  return normalizeBigInts(rows);
}

app.post("/api/register", async (req, res) => {
  let conn;
  try {
    const { email, password, name, phone, birthdate } = req.body;
    const hashedPassword = await bcrypt.hash(password, 10);

    conn = await pool.getConnection();
    await conn.query(
      `
        INSERT INTO Users (email, password, name, phone, birthdate)
        VALUES (?, ?, ?, ?, ?)
      `,
      [email, hashedPassword, name, phone, birthdate],
    );

    res.status(201).json({ message: "회원가입이 완료되었습니다." });
  } catch (err) {
    if (err.code === "ER_DUP_ENTRY") {
      return res.status(400).json({ message: "이미 가입된 이메일입니다." });
    }

    console.error(err);
    res.status(500).json({ message: "서버 에러" });
  } finally {
    if (conn) conn.release();
  }
});

app.post("/api/login", async (req, res) => {
  let conn;
  try {
    const { email, password } = req.body;

    conn = await pool.getConnection();
    const rows = await conn.query("SELECT * FROM Users WHERE email = ?", [
      email,
    ]);

    if (rows.length === 0) {
      return res.status(401).json({ message: "사용자를 찾을 수 없습니다." });
    }

    const user = rows[0];
    const isMatch = await bcrypt.compare(password, user.password);

    if (!isMatch) {
      return res.status(401).json({ message: "비밀번호가 일치하지 않습니다." });
    }

    const token = jwt.sign(
      { id: user.id, email: user.email },
      process.env.JWT_SECRET,
      { expiresIn: "1h" },
    );

    res.json({
      message: "로그인 성공",
      token,
      name: user.name,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "서버 에러" });
  } finally {
    if (conn) conn.release();
  }
});

app.get("/api/me", authenticateToken, async (req, res) => {
  let conn;
  try {
    conn = await pool.getConnection();
    const rows = await conn.query(
      `
        SELECT id, email, name, phone, birthdate
        FROM Users
        WHERE id = ?
      `,
      [req.user.id],
    );

    if (rows.length === 0) {
      return res.status(404).json({ message: "사용자를 찾을 수 없습니다." });
    }

    res.json(normalizeBigInts(rows[0]));
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "내 정보 조회 실패" });
  } finally {
    if (conn) conn.release();
  }
});

app.put("/api/me", authenticateToken, async (req, res) => {
  let conn;
  try {
    const { name, phone, birthdate, password } = req.body;

    conn = await pool.getConnection();
    const rows = await conn.query(
      `
        SELECT id, email, name, phone, birthdate
        FROM Users
        WHERE id = ?
      `,
      [req.user.id],
    );

    if (rows.length === 0) {
      return res.status(404).json({ message: "사용자를 찾을 수 없습니다." });
    }

    const currentUser = rows[0];
    const nextName = (name ?? currentUser.name ?? "").trim();
    const nextPhone = (phone ?? currentUser.phone ?? "").trim();
    const nextBirthdate = birthdate ?? currentUser.birthdate ?? null;

    if (!nextName) {
      return res.status(400).json({ message: "이름은 비워둘 수 없습니다." });
    }

    await conn.query(
      `
        UPDATE Users
        SET name = ?, phone = ?, birthdate = ?
        WHERE id = ?
      `,
      [nextName, nextPhone, nextBirthdate, req.user.id],
    );

    if (password && password.trim()) {
      const hashedPassword = await bcrypt.hash(password.trim(), 10);
      await conn.query("UPDATE Users SET password = ? WHERE id = ?", [
        hashedPassword,
        req.user.id,
      ]);
    }

    const updatedRows = await conn.query(
      `
        SELECT id, email, name, phone, birthdate
        FROM Users
        WHERE id = ?
      `,
      [req.user.id],
    );

    res.json({
      message: "회원 정보가 수정되었습니다.",
      user: normalizeBigInts(updatedRows[0]),
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "회원 정보 수정 실패" });
  } finally {
    if (conn) conn.release();
  }
});

app.post("/api/records", authenticateToken, async (req, res) => {
  let conn;
  try {
    const { title, current_asset, monthly_saving, goal_amount } = req.body;

    if (!title || goal_amount === undefined || goal_amount === null) {
      return res.status(400).json({ message: "제목과 목표 금액은 필수입니다." });
    }

    conn = await pool.getConnection();

    const userRows = await conn.query("SELECT name FROM Users WHERE id = ?", [
      req.user.id,
    ]);
    const authorName = userRows[0]?.name || null;

    const result = await conn.query(
      `
        INSERT INTO Records
        (user_id, title, current_asset, monthly_saving, goal_amount, author_name)
        VALUES (?, ?, ?, ?, ?, ?)
      `,
      [
        req.user.id,
        title,
        Number(current_asset || 0),
        Number(monthly_saving || 0),
        Number(goal_amount || 0),
        authorName,
      ],
    );

    res.status(201).json({
      message: "기록 등록 성공",
      id: Number(result.insertId),
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "서버 에러" });
  } finally {
    if (conn) conn.release();
  }
});

app.get("/api/records", authenticateToken, async (req, res) => {
  let conn;
  try {
    conn = await pool.getConnection();

    const rows = await conn.query(
      `
        SELECT
          r.id,
          r.user_id,
          r.title,
          r.current_asset,
          r.monthly_saving,
          r.goal_amount,
          r.created_at,
          r.category,
          r.view_count,
          COALESCE(u.name, r.author_name, '익명') AS author_name,
          (
            SELECT COUNT(*)
            FROM Comments c
            WHERE c.record_id = r.id
          ) AS comment_count
        FROM Records r
        JOIN Users u ON u.id = r.user_id
        WHERE r.user_id = ?
        ORDER BY r.created_at DESC
      `,
      [req.user.id],
    );

    res.json(normalizeBigInts(rows));
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "조회 실패" });
  } finally {
    if (conn) conn.release();
  }
});

app.get("/api/feed", authenticateToken, async (req, res) => {
  let conn;
  try {
    conn = await pool.getConnection();

    const rows = await conn.query(
      `
        SELECT
          r.id,
          r.user_id,
          r.title,
          r.current_asset,
          r.monthly_saving,
          r.goal_amount,
          r.view_count,
          r.created_at,
          COALESCE(u.name, r.author_name, '익명') AS author_name,
          (
            SELECT COUNT(*)
            FROM Comments c
            WHERE c.record_id = r.id
          ) AS comment_count
        FROM Records r
        JOIN Users u ON u.id = r.user_id
        ORDER BY r.created_at DESC
      `,
    );

    res.json(normalizeBigInts(rows));
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "피드 조회 실패" });
  } finally {
    if (conn) conn.release();
  }
});

app.get("/api/records/:id", authenticateToken, async (req, res) => {
  let conn;
  try {
    const { id } = req.params;

    conn = await pool.getConnection();
    await conn.query("UPDATE Records SET view_count = view_count + 1 WHERE id = ?", [
      id,
    ]);

    const rows = await conn.query(
      `
        SELECT
          r.id,
          r.user_id,
          r.title,
          r.current_asset,
          r.monthly_saving,
          r.goal_amount,
          r.created_at,
          r.category,
          r.view_count,
          COALESCE(u.name, r.author_name, '익명') AS author_name,
          (
            SELECT COUNT(*)
            FROM Comments c
            WHERE c.record_id = r.id
          ) AS comment_count
        FROM Records r
        JOIN Users u ON u.id = r.user_id
        WHERE r.id = ?
      `,
      [id],
    );

    if (rows.length === 0) {
      return res.status(404).json({ message: "기록을 찾을 수 없습니다." });
    }

    const record = normalizeBigInts(rows[0]);
    const comments = await fetchComments(conn, id);

    res.json({
      ...record,
      comments,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "상세 조회 실패" });
  } finally {
    if (conn) conn.release();
  }
});

app.post("/api/records/:id/comments", authenticateToken, async (req, res) => {
  let conn;
  try {
    const { id } = req.params;
    const content = (req.body.content || "").trim();

    if (!content) {
      return res.status(400).json({ message: "댓글 내용을 입력해주세요." });
    }

    conn = await pool.getConnection();

    const recordRows = await conn.query("SELECT id FROM Records WHERE id = ?", [id]);
    if (recordRows.length === 0) {
      return res.status(404).json({ message: "기록을 찾을 수 없습니다." });
    }

    await conn.query(
      `
        INSERT INTO Comments (record_id, user_id, content)
        VALUES (?, ?, ?)
      `,
      [id, req.user.id, content],
    );

    const comments = await fetchComments(conn, id);

    res.status(201).json({
      message: "댓글 등록 성공",
      comments,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "댓글 등록 실패" });
  } finally {
    if (conn) conn.release();
  }
});

app.delete("/api/records/:id", authenticateToken, async (req, res) => {
  let conn;
  try {
    const { id } = req.params;

    conn = await pool.getConnection();

    const result = await conn.query(
      "DELETE FROM Records WHERE id = ? AND user_id = ?",
      [id, req.user.id],
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: "삭제할 기록이 없습니다." });
    }

    res.json({ message: "기록 삭제 성공" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "서버 에러" });
  } finally {
    if (conn) conn.release();
  }
});

app.delete("/api/users/:id", async (req, res) => {
  let conn;
  try {
    const { id } = req.params;

    conn = await pool.getConnection();
    const result = await conn.query("DELETE FROM Users WHERE id = ?", [id]);

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: "사용자가 없습니다." });
    }

    res.json({ message: "삭제 성공" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "서버 에러" });
  } finally {
    if (conn) conn.release();
  }
});

const PORT = process.env.PORT || 3000;

ensureSchema()
  .then(() => {
    app.listen(PORT, () => console.log(`Server running on ${PORT}`));
  })
  .catch((err) => {
    console.error("Failed to initialize schema", err);
    process.exit(1);
  });
