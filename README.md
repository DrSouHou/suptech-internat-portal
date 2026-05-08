# SupTech Internat Portal

![SupTech Internat](https://img.shields.io/badge/Status-Active-success.svg)
![Version](https://img.shields.io/badge/Version-1.0.0-blue.svg)

A modern, responsive web application dashboard for managing the **SupTech Internat** (student dormitories) for **SupTech Santé** and **SupTech Environnement** (FRDISI / Suptech Info) located in Mohammedia.

## 🚀 Features

The application is built around two distinct user roles, offering specific interfaces and functionalities for each:

### 🛡️ Administrator Panel
* **Dashboard & Analytics:** Real-time statistics, monthly revenue tracking, and occupancy charts powered by **Chart.js**.
* **Resident Management:** View, add, and manage students across both institutions. Tracks payment statuses and resident scores.
* **Room Management:** Interactive grid representing room occupancy, distinguishing between individual and double rooms.
* **Finance Tracking:** Monitor monthly rent payments, caution fees, and outstanding debts.
* **Claims Handling:** Respond to student maintenance or administrative requests.
* **Administrator Management:** FRDISI coordinators can add or remove admin accounts.

### 🎓 Resident Portal (Student Space)
* **Personal Dashboard:** Quick overview of room status, rent payments, and internal resident score.
* **Digital ID & Room Access:** Access to personal QR codes and room information.
* **Billing & Invoices:** View payment history and download monthly rent invoices.
* **Claims Submission:** Easily submit maintenance requests (WiFi, Plumbing, Electricity, etc.) to the administration.
* **Contract Renewal:** One-click requests to renew or upgrade room reservations for the upcoming academic year.

## 🎨 Design & UI/UX

* **Modern Aesthetics:** Features a premium cyan-blue gradient theme (`#00d2ff` to `#3a7bd5`).
* **Glassmorphism:** Elegant semi-transparent panels with background blurs.
* **Responsive Layout:** A fluid, mobile-first design ensuring a seamless experience on smartphones, tablets, and desktop computers.
* **SVG Iconography:** Lightweight, crisp, and fully scalable inline icons.
* **Interactive Elements:** Micro-animations, toast notifications, and smooth transitions enhance the user experience.

## 🛠️ Technologies Used

* **HTML5:** Semantic and accessible structure.
* **Vanilla CSS3:** Custom design system utilizing CSS Variables for consistent theming and a flexbox/grid layout system. 
* **Vanilla JavaScript (ES6+):** Handling DOM manipulation, state management (mocked for demo), and view transitions without heavy frameworks.
* **Chart.js (v4.4):** For rendering interactive, canvas-based charts and analytics.

## 📁 File Structure

```text
/
├── index.html     # Main entry point containing both Admin and Resident views
├── style.css      # Custom styling, animations, and responsive breakpoints
├── script.js      # App logic, view switching, modal handling, and Chart.js initialization
└── README.md      # Project documentation
```

## ⚙️ Getting Started

Because this project is built using native web technologies without a build step, getting started is incredibly simple:

1. **Clone the repository:**
   ```bash
   git clone https://github.com/DrSouHou/suptech-internat-portal.git
   ```
2. **Navigate to the directory:**
   ```bash
   cd suptech-internat-portal
   ```
3. **Run the application:**
   Simply open the `index.html` file in any modern web browser (Chrome, Firefox, Safari, Edge).
   
*(Optional)* If you prefer using a local server:
```bash
npx serve .
```

## 🔑 Demo Access

The login screen provides two roles for demonstration:
* **Admin Demo:** `admin@suptech.ma` (Password: `adminpassword`)

## ⚖️ License & Copyright

**Copyright © 2026 HAFIDI Souhail & Adam DANI. All Rights Reserved.**

This software is the intellectual property of **HAFIDI Souhail** (Lead Backend & Systems Architect) and **Adam DANI** (Lead Frontend & UI/UX Developer). 

Unauthorized copying, distribution, or modification of the source code, via any medium, is strictly prohibited without the express written consent of the authors. This project was developed as a digitalization initiative for **UIB/FRDISI - Mohammedia**.
