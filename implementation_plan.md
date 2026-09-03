# St. Vincent's School HRMS — UI/UX Design System Standardization Plan

A unified, restrained, institutional design system for **St. Vincent's School HRMS** to make the entire platform feel like a cohesive, professional school administration software.

## User Review Required

> [!IMPORTANT]
> - **Zero functional/business logic changes**: Backend APIs, PostgreSQL tables, JWT auth, RBAC permissions, and attendance/leave calculations remain 100% untouched.
> - **Design philosophy**: Content-first, institutional elegance, high contrast, clean typography, standardized spacing, and removal of visual clutter/excessive gradients.

---

## 1. Design System Tokens & Foundations (`index.css` & `App.css`)

### Color Palette (Institutional School Theme)
- **Primary / School Blue**: `#1e40af` (Deep Royal Navy) / `#2563eb` (Brand Accent) / `#1d4ed8` (Hover)
- **Neutral Background**: `#f8fafc` (Slate-50) for app background, `#ffffff` for cards/surfaces
- **Text Hierarchy**:
  - Primary Text: `#0f172a` (Slate-900)
  - Secondary Text: `#475569` (Slate-600)
  - Muted Text: `#64748b` (Slate-500)
- **Borders & Dividers**: `#e2e8f0` (Slate-200) / `#eaecf0`
- **Semantic States**:
  - Success: `#059669` (Text) / `#ecfdf5` (Bg) / `#a7f3d0` (Border)
  - Warning: `#b45309` (Text) / `#fffbeb` (Bg) / `#fde68a` (Border)
  - Danger: `#dc2626` (Text) / `#fef2f2` (Bg) / `#fecaca` (Border)
  - Neutral/Inactive: `#475569` (Text) / `#f1f5f9` (Bg) / `#e2e8f0` (Border)

---

## 2. Component Refinements

### A. Sidebar Navigation (`Sidebar.jsx` & `App.css`)
- **Background**: Deep institutional navy (`#0b1324` or `#0f172a`).
- **Active Navigation Item**: Soft neutral/blue tinted background (`rgba(255, 255, 255, 0.08)`), crisp white text, and a sleek 3px accent bar indicator on the left.
- **Inactive Items**: Muted slate text (`#94a3b8`), clean hover state (`rgba(255, 255, 255, 0.04)`).
- **Subnav Grouping**: Clean 24px left indentation, subtle bullet indicator, subordinate font size (0.82rem).
- **Brand Header**: Prominent St. Vincent's Crest Logo (48px) + crisp typography ("St. Vincent's School", "Human Resource System").
- **Footer Profile**: Clean integrated card displaying staff avatar, full name, role badge, and logout button.

### B. Standardized Top Header (`Header.jsx` & `App.css`)
- Clean height (68px), crisp white surface, 1px bottom border.
- Institutional breadcrumb trail with subtle brand badge.
- Page title (`1.25rem`, bold, `#0f172a`) + description (`0.8rem`, `#64748b`).
- Right-hand control cluster: Quick Check-In / Check-Out pill, Date pill, 2FA status, and Sync button.

### C. Restrained Dashboard Hero & KPI Cards (`Dashboard.jsx`, `EmployeeDashboardView.jsx`)
- Replace oversaturated gradients with a clean institutional executive header.
- Standardize all KPI metric cards across Dashboard, Attendance, Leave, Shifts, and Academic Calendar:
  - Header: `LABEL` (uppercase, `0.72rem`, `#64748b`, font-weight 700)
  - Metric: `VALUE` (`1.65rem`, font-weight 800, `#0f172a`)
  - Subtext: `Supporting info` (`0.76rem`, `#64748b`)
  - Subtle contextual icon container.

### D. Standardized Data Tables & Badges
- Header row: `#f8fafc` background, uppercase slate labels (`0.75rem`), border bottom `#e2e8f0`.
- Data rows: Clean 48px–54px row height, `#0f172a` primary text, hover row highlighting (`#f8fafc`).
- Standardized action buttons: Clean ghost icons (`btn-ghost btn-xs`) for View, Edit, Delete, Toggle.
- Standardized status badges: Soft pill backgrounds with clear semantic colors.

### E. Standardized Forms & Modals
- Clean headers, grouped form sections with subtle section labels, 2-column responsive layout, standardized 38px input heights, and unified Primary (Save/Submit) and Secondary (Cancel/Close) action footers.

---

## 3. Verification Plan
- Verify full frontend compilation with `npm run build` (0 errors).
- Visually verify all core views across Desktop, Tablet, and Mobile.
- Verify that all REST APIs and auth/attendance/leave workflows continue operating with 100% test pass rate.
