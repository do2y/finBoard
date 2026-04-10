const propertyData = [
  {
    id: 1,
    name: "마포 리버센트",
    district: "서울 마포구",
    priceLabel: "12.4억",
    priceRaw: 1240000000,
    area: "공급 84.1㎡ / 전용 59.9㎡",
    lat: 37.5536,
    lng: 126.9122,
    img: "https://images.unsplash.com/photo-1484154218962-a197022b5858?auto=format&fit=crop&w=1200&q=80",
  },
  {
    id: 2,
    name: "성동 포레하임",
    district: "서울 성동구",
    priceLabel: "15.8억",
    priceRaw: 1580000000,
    area: "공급 95.2㎡ / 전용 74.8㎡",
    lat: 37.5482,
    lng: 127.0477,
    img: "https://images.unsplash.com/photo-1494526585095-c41746248156?auto=format&fit=crop&w=1200&q=80",
  },
  {
    id: 3,
    name: "동작 스카이뷰",
    district: "서울 동작구",
    priceLabel: "10.9억",
    priceRaw: 1090000000,
    area: "공급 78.5㎡ / 전용 59.7㎡",
    lat: 37.5031,
    lng: 126.9515,
    img: "https://images.unsplash.com/photo-1505693416388-ac5ce068fe85?auto=format&fit=crop&w=1200&q=80",
  },
  {
    id: 4,
    name: "송파 레이크팰리스",
    district: "서울 송파구",
    priceLabel: "18.3억",
    priceRaw: 1830000000,
    area: "공급 109.4㎡ / 전용 84.9㎡",
    lat: 37.5112,
    lng: 127.098,
    img: "https://images.unsplash.com/photo-1512917774080-9991f1c4c750?auto=format&fit=crop&w=1200&q=80",
  },
  {
    id: 5,
    name: "영등포 센트럴힐",
    district: "서울 영등포구",
    priceLabel: "9.6억",
    priceRaw: 960000000,
    area: "공급 72.6㎡ / 전용 49.9㎡",
    lat: 37.5264,
    lng: 126.8962,
    img: "https://images.unsplash.com/photo-1505693416388-ac5ce068fe85?auto=format&fit=crop&w=1200&q=80",
  },
];

const assetInput = document.getElementById("asset-input");
const incomeInput = document.getElementById("income-input");
const interestInput = document.getElementById("interest-input");
const slider = document.getElementById("save-slider");
const saveValText = document.getElementById("save-val");
const saveAmountText = document.getElementById("save-amount");
const logoutButton = document.getElementById("logoutButton");
const updateButton = document.getElementById("updateButton");

let chart;
let map;
let markerLayer;
let currentPropertyIndex = 0;

function formatManwon(value) {
  return `${Math.round(value).toLocaleString()}만원`;
}

function formatUk(value) {
  if (value <= 0) return "0원";
  return `${(value / 100000000).toFixed(1)}억`;
}

function getMonthlySave() {
  const income = Number(incomeInput.value || 0);
  const ratio = Number(slider.value || 0) / 100;
  return income * ratio;
}

function getAssetWon() {
  return Number(assetInput.value || 0) * 10000;
}

function parseJwt(token) {
  try {
    return JSON.parse(atob(token.split(".")[1]));
  } catch (error) {
    return null;
  }
}

function updateSliderSummary() {
  const ratio = Number(slider.value || 0);
  const monthlySave = getMonthlySave();

  saveValText.innerText = String(ratio);
  saveAmountText.innerText = formatManwon(monthlySave);

  if (ratio >= 55) {
    saveValText.className = "text-red-500 font-bold";
    saveAmountText.className = "text-sm font-semibold text-red-500";
  } else {
    saveValText.className = "text-[var(--navy)] font-bold";
    saveAmountText.className = "text-sm font-semibold text-slate-500";
  }
}

function getRecommendation(shortfallWon, monthsToTarget, saveRatio) {
  if (shortfallWon <= 0) {
    return "현재 자산만으로도 접근 가능한 수준입니다. 대출 없이 가능한 매물인지 세부 조건만 더 확인해보세요.";
  }

  if (saveRatio < 0.25) {
    return "저축 비율이 낮은 편입니다. 고정비를 줄여 30% 이상으로 올리면 목표 도달 시점이 훨씬 빨라집니다.";
  }

  if (monthsToTarget > 60) {
    return "목표까지 5년 이상 걸립니다. 지역을 넓히거나 면적 기준을 낮춰 현실적인 후보군을 같이 보세요.";
  }

  if (monthsToTarget > 24) {
    return "도달 가능성이 있습니다. 이 구간에서는 월 저축액을 10~15% 정도만 높여도 체감 차이가 큽니다.";
  }

  return "2년 안쪽으로 보이는 좋은 후보입니다. 금리와 취득 부대비용까지 합쳐 실제 현금흐름을 점검해보세요.";
}

function updateInsightCard(data, shortfallWon, monthsToTarget) {
  const closestMatch = document.getElementById("closest-match");
  const closestDesc = document.getElementById("closest-desc");
  const savePlan = document.getElementById("save-plan");
  const recommendation = document.getElementById("recommendation");
  const userTitle = document.getElementById("userTitle");

  const userName = localStorage.getItem("userName") || "사용자";
  const saveRatio = Number(slider.value || 0) / 100;
  const monthlySave = getMonthlySave();

  userTitle.innerText = `${userName}님의 주거 목표 브리프`;
  closestMatch.innerText = data.name;
  closestDesc.innerText = `${data.district} · ${data.priceLabel} · ${data.area}`;
  savePlan.innerText = `${formatManwon(monthlySave)} / 월`;
  recommendation.innerText = getRecommendation(shortfallWon, monthsToTarget, saveRatio);
}

function renderChart(targetPriceWon, currentAssetWon, monthlySaveWon) {
  const canvas = document.getElementById("priceChart");
  if (chart) chart.destroy();

  const labels = ["현재", "1년", "2년", "3년", "4년"];
  const assetCurve = labels.map((_, index) => currentAssetWon + monthlySaveWon * 12 * index);
  const targetCurve = labels.map((_, index) => Math.round(targetPriceWon * (1 + 0.018 * index)));

  chart = new Chart(canvas, {
    type: "line",
    data: {
      labels,
      datasets: [
        {
          label: "예상 목표 가격",
          data: targetCurve,
          borderColor: "#cbd5e1",
          borderDash: [6, 4],
          fill: false,
          tension: 0.35,
        },
        {
          label: "내 자산 성장",
          data: assetCurve,
          borderColor: "#1367ff",
          backgroundColor: "rgba(19, 103, 255, 0.12)",
          fill: true,
          tension: 0.35,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label(context) {
              return formatUk(context.raw);
            },
          },
        },
      },
      scales: {
        y: {
          display: false,
        },
        x: {
          grid: { display: false },
        },
      },
    },
  });
}

function updatePropertyReport(index) {
  currentPropertyIndex = index;
  const data = propertyData[index];
  if (!data) return;

  const myAssetWon = getAssetWon();
  const monthlySaveWon = getMonthlySave() * 10000;
  const saveRatio = Number(slider.value || 0);
  const interestRate = Number(interestInput.value || 0) / 100;
  const shortfallWon = Math.max(0, data.priceRaw - myAssetWon);
  const monthsToTarget =
    shortfallWon > 0 && monthlySaveWon > 0 ? Math.ceil(shortfallWon / monthlySaveWon) : 0;
  const years = Math.floor(monthsToTarget / 12);
  const months = monthsToTarget % 12;
  const readiness = Math.min(100, Math.round((myAssetWon / data.priceRaw) * 100));
  const annualLoanCost = shortfallWon * interestRate;

  const propStatus = document.getElementById("prop-status");
  if (readiness >= 100) {
    propStatus.innerText = "즉시 접근 가능";
    propStatus.className =
      "rounded-full bg-green-100 px-4 py-2 text-xs font-bold text-green-600";
  } else if (readiness >= 70) {
    propStatus.innerText = "대출 포함 유력";
    propStatus.className =
      "rounded-full bg-blue-100 px-4 py-2 text-xs font-bold text-blue-600";
  } else if (readiness >= 45) {
    propStatus.innerText = "중기 목표권";
    propStatus.className =
      "rounded-full bg-amber-100 px-4 py-2 text-xs font-bold text-amber-600";
  } else {
    propStatus.innerText = "장기 계획 필요";
    propStatus.className =
      "rounded-full bg-slate-100 px-4 py-2 text-xs font-bold text-slate-500";
  }

  document.getElementById("prop-name").innerText = data.name;
  document.getElementById("prop-price").innerText = `${data.district} · ${data.priceLabel}`;
  document.getElementById("prop-area").innerText = data.area;
  document.getElementById("prop-img").src = data.img;
  document.getElementById("shortfall").innerText = formatUk(shortfallWon);
  document.getElementById("monthly-save").innerText = formatManwon(getMonthlySave());
  document.getElementById("loan-cost").innerText =
    shortfallWon > 0 ? `${formatUk(annualLoanCost)} / 연` : "대출 불필요";
  document.getElementById("target-period").innerText =
    shortfallWon <= 0
      ? "지금 바로 가능"
      : monthlySaveWon <= 0
        ? "저축 계획 필요"
        : years > 0
          ? `${years}년 ${months}개월`
          : `${monthsToTarget}개월`;

  document.getElementById("readiness-bar").style.width = `${Math.min(readiness, 100)}%`;
  document.getElementById("prop-tip").innerText =
    shortfallWon <= 0
      ? "현재 자산으로도 접근 가능한 후보입니다. 취득세와 이사비용까지 포함한 총비용을 마지막으로 확인해보세요."
      : `${formatUk(shortfallWon)} 정도가 부족합니다. 현재 저축 비율 ${saveRatio}%를 유지하면 목표까지 ${document.getElementById("target-period").innerText} 정도가 예상됩니다.`;

  updateInsightCard(data, shortfallWon, monthsToTarget);
  renderChart(data.priceRaw, myAssetWon, monthlySaveWon);
}

function getMarkerColor(ratio) {
  if (ratio >= 1) return "#16a34a";
  if (ratio >= 0.7) return "#1367ff";
  if (ratio >= 0.45) return "#f59e0b";
  return "#64748b";
}

function renderMarkers() {
  if (markerLayer) {
    markerLayer.remove();
  }

  markerLayer = L.layerGroup().addTo(map);
  const myAssetWon = getAssetWon();

  propertyData.forEach((property, index) => {
    const ratio = myAssetWon / property.priceRaw;
    const color = getMarkerColor(ratio);

    const icon = L.divIcon({
      className: "",
      html: `<div class="marker-chip" style="background:${color}">${property.priceLabel}</div>`,
      iconSize: [80, 34],
      iconAnchor: [40, 17],
    });

    const marker = L.marker([property.lat, property.lng], { icon }).addTo(markerLayer);
    marker.on("click", () => {
      updatePropertyReport(index);
      map.flyTo([property.lat, property.lng], 13, { duration: 0.8 });
    });
  });
}

function initializeMap() {
  map = L.map("map", { zoomControl: false }).setView([37.5448, 127.0017], 12);

  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    attribution: "&copy; OpenStreetMap contributors",
  }).addTo(map);
}

function initializeInteractions() {
  slider.addEventListener("input", () => {
    updateSliderSummary();
    updatePropertyReport(currentPropertyIndex);
  });

  [assetInput, incomeInput, interestInput].forEach((input) => {
    input.addEventListener("input", () => {
      updateSliderSummary();
      renderMarkers();
      updatePropertyReport(currentPropertyIndex);
    });
  });

  updateButton.addEventListener("click", () => {
    renderMarkers();
    updatePropertyReport(currentPropertyIndex);
  });

  logoutButton.addEventListener("click", () => {
    localStorage.clear();
    location.href = "/index.html";
  });
}

function initializeAuth() {
  const token = localStorage.getItem("token");
  if (!token || !parseJwt(token)) {
    alert("로그인이 필요합니다.");
    location.href = "/index.html";
  }
}

window.addEventListener("load", () => {
  initializeAuth();
  initializeMap();
  initializeInteractions();
  updateSliderSummary();
  renderMarkers();
  updatePropertyReport(0);
});
