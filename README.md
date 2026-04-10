## ■ FinBoard

자산 데이터를 기반으로 목표 달성 시점을 계산하고 공유하는 데이터 중심 커뮤니티 서비스

### ■ 1. 프로젝트 개요

FinBoard는 사용자가 자신의 자산 정보를 입력하면
목표까지의 진행률과 예상 기간을 자동으로 계산하고
이를 게시글 형태로 공유할 수 있는 서비스입니다.

기존 텍스트 중심 게시판과 달리,
데이터를 기반으로 한 인사이트 공유에 초점을 맞추었습니다.

### ■ 2. 사용 기술

Frontend

HTML / CSS / Tailwind CSS
Vanilla JavaScript

Backend

Node.js (Express)

Database

MariaDB

Infra

GCP VM
Cloudflare (HTTPS, SSL)

Auth

JWT (JSON Web Token)

### ■ 3. 주요 기능

사용자 인증
로그인 시 JWT 발급
인증된 사용자만 게시글 작성 및 접근 가능
게시글 관리
게시글 생성, 조회, 삭제
사용자별 권한 검증
자산 기반 계산 기능
현재 자산, 월 저축액, 목표 금액 입력
목표 달성 기간 자동 계산
진행률(%) 자동 계산
데이터 기반 UI
게시글을 카드 형태로 시각화
진행률과 자산 정보를 직관적으로 표현
커뮤니티 기능
조회수 표시
댓글 작성 및 조회
요약 정보 제공
전체 게시글 수
조회수 기준 인기 게시글
댓글 기준 활성 게시글

### ■ 4. 시스템 구조

Client (HTML, JS)
→ Express Server (API)
→ MariaDB (Database)
