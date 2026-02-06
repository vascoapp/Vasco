# Vasco - AI-Native Construction Trades Platform

## Overview
Mobile-first app for construction trades (plumbing, electrical, gas) serving contractors, site leads, COOs, CFOs, and directors in UK, Netherlands, and Germany.

## Tech Stack
- **Framework:** React Native + Expo (Expo Router v6, file-based routing)
- **Language:** TypeScript
- **State:** React Context API (AuthContext, AppState)
- **Backend:** Supabase (database + auth)
- **Payments:** Mollie
- **Accounting:** Moneybird
- **Icons:** Ionicons

## Project Structure
```
app/                  # Screen routes (Expo Router)
  (tabs)/             # Role-specific tabbed navigation
  contractor/         # Contractor screens
  sitelead/           # Site lead screens
src/
  components/         # ~60 React components
    dashboards/       # 24 role/feature dashboards
    contractor/       # 56 contractor components
    financial-auditor/# Financial audit components
    sitelead/         # Site lead components
    shared/           # 17 reusable components
  services/           # 41 business logic services
  types/              # 20 TypeScript type definition files
  context/            # AuthContext (multi-role)
  state/              # AppState context
  integrations/       # Mollie, Moneybird
  intelligence/       # AI models (pricing, decisions)
  theme/              # Colors, styling
docs/                 # Planning & architecture documents
```

## Key Commands
```bash
npx expo start        # Start dev server
npx expo start --ios  # Start on iOS simulator
npx expo start --android # Start on Android emulator
```

## Architecture Notes
- 5 user roles: Contractor, Site Lead, COO, CFO, Director
- Each role has dedicated dashboards with 4-tab navigation
- Services use TypeScript interfaces for all domain models
- AI reasoning engine provides step-by-step explanations
- Agent automation supports 28+ action types with approval workflows
- Evidence graph tracks connections: jobs -> photos -> tests -> compliance

## Conventions
- Use TypeScript for all new files
- Follow existing service pattern: export functions, typed interfaces
- Components go in role-specific subdirectories under `src/components/`
- New services go in `src/services/` with matching types in `src/types/`
- Use the existing theme colors from `src/theme/`
