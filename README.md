## FinBoard
### 1. 프로젝트 개요

수행 주제:
JWT 기반 사용자 인증이 포함된 데이터 기반 게시판 서비스

배포 주소:
[(Cloudflare 도메인 URL 입력)](https://doctrine-remix-recipe-scoring.trycloudflare.com/)

사용 기술:
HTML, CSS, Tailwind CSS, JavaScript, Node.js(Express), MariaDB, JWT, GCP, Cloudflare

### 2. 백엔드 구성 및 라우팅

server.js를 중심으로 Express 기반 API 서버를 구성하였으며,
사용자 인증과 게시글 데이터 처리를 위한 라우팅을 설계했습니다.

주요 API 경로는 다음과 같습니다.

인증 관련

POST /login
→ 사용자 로그인 및 JWT 발급

게시글 관련

GET /api/feed
→ 전체 게시글 목록 조회 (최신순 정렬)
POST /api/records
→ 게시글 생성 (자산 데이터 포함)
GET /api/records/:id
→ 특정 게시글 상세 조회 (조회수 증가 포함)
DELETE /api/records/:id
→ 게시글 삭제 (작성자만 가능)

댓글 관련

POST /api/records/:id/comments
→ 댓글 작성 및 목록 반환

모든 보호된 API는 JWT 토큰을 기반으로 인증을 수행하며,
사용자 ID를 추출하여 작성 권한을 검증하도록 구현했습니다.

### 3. 데이터베이스 및 SQL 활용

MariaDB를 사용하여 사용자, 게시글, 댓글 데이터를 관리했습니다.

사용 테이블

Users (사용자)

id
email
password
name

Posts (게시글)

id
user_id
title
current_asset
monthly_saving
goal_amount
view_count
created_at

Comments (댓글)

id
post_id
user_id
content
created_at

주요 SQL

게시글 목록 조회 (최신순)
SELECT * FROM Posts ORDER BY created_at DESC;
특정 게시글 조회
SELECT * FROM Posts WHERE id = ?;
게시글 생성
INSERT INTO Posts (user_id, title, current_asset, monthly_saving, goal_amount)
VALUES (?, ?, ?, ?, ?);
게시글 삭제 (작성자 검증)
DELETE FROM Posts WHERE id = ? AND user_id = ?;
댓글 조회
SELECT * FROM Comments WHERE post_id = ? ORDER BY created_at ASC;

SQL 조건문을 활용하여 로그인한 사용자 기준으로 데이터 접근을 제어했습니다.

### 4. 인프라 및 배포 기록

클라우드 서버 (GCP)

GCP VM 인스턴스를 생성하여 Node.js 서버를 실행
MariaDB와 연결하여 데이터 저장 및 조회 처리
포트 개방 및 서버 실행 환경 구성

도메인 및 보안 (Cloudflare)

Cloudflare를 통해 도메인 연결
HTTPS(SSL) 적용으로 보안 접속 구성
외부에서 접근 가능한 서비스 환경 구축

### 5. 트러블슈팅 (문제 해결 기록)

사례 1. API 경로 불일치 문제
프론트엔드에서 요청하는 API 경로와 서버의 라우팅 경로가 달라
데이터가 정상적으로 불러와지지 않는 문제가 발생했습니다.
→ API 경로를 일관되게 통일하여 해결했습니다.

사례 2. renderPosts 함수 중복 선언
동일한 함수가 두 번 선언되어 의도하지 않은 UI 렌더링이 발생했습니다.
→ 하나의 함수로 통합하여 문제를 해결했습니다.

사례 3. JWT 파싱 오류
토큰이 없는 상태에서 JWT를 파싱하려고 하면서 오류가 발생했습니다.
→ 예외 처리를 추가하여 안정성을 확보했습니다.

사례 4. Modal DOM 누락
JavaScript에서 사용하는 Modal 요소가 HTML에 존재하지 않아
클릭 시 오류가 발생했습니다.
→ 필요한 DOM 구조를 추가하여 해결했습니다.

사례 5. CSS 변수 미정의
일부 UI에서 색상이 정상적으로 적용되지 않는 문제가 발생했습니다.
→ :root에 CSS 변수를 정의하여 해결했습니다.

### 6. 최종 회고

8시간이라는 제한된 시간 내에
기획부터 개발, 배포까지 전 과정을 수행하며
전체 서비스 흐름을 경험할 수 있었습니다.

단순 CRUD 구현을 넘어서
사용자의 자산 데이터를 기반으로 계산 결과를 제공하는 구조를 설계하며
데이터 기반 서비스의 중요성을 이해할 수 있었습니다.

특히, 사용자 입력 데이터를 활용하여
진행률과 목표 달성 기간을 시각적으로 제공한 점이 의미 있었습니다.

개선 계획

게시글 수정 기능 추가
검색 및 필터 기능 구현
자산 변화 그래프 시각화
사용자 경험(UI/UX) 개선
