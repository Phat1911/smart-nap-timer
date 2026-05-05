                    ┌─────────────────────────────────────────┐
                    │            ENTRY POINT                  │
                    │   index.ts → registerRootComponent()    │
                    └──────────────────┬──────────────────────┘
                                       │
                    ┌──────────────────▼──────────────────────┐
                    │              App.tsx                    │
                    │  • Error boundary                       │
                    │  • Font loading (expo-font)             │
                    │  • SafeAreaProvider                     │
                    │  • LanguageProvider (i18n)              │
                    │  • TopRightProvider (lang toggle)       │
                    │  • NavigationBar hidden (Android)       │
                    │  • LangToggleButton overlay             │
                    │  • Renders → AppNavigator               │
                    └──────────────────┬──────────────────────┘
                                       │
          ┌────────────────────────────┼────────────────────────────┐
          │                            │                            │
          ▼                            ▼                            ▼
┌──────────────────┐  ┌──────────────────────────┐  ┌──────────────────────┐
│   Onboarding     │  │      Main Tabs           │  │   Nap Flow Screens   │
│   Screen         │  │  (Bottom Tab Navigator)  │  │   (Stack Navigator)  │
│                  │  │                          │  │                      │
│ • First-run      │  │  Home  │ Dashboard │     │  │ Monitoring           │
│ • Permissions    │  │        │           │     │  │   ↓                  │
│ • Tutorial       │  │  Settings│           │     │  │ Sleeping             │
│   → navigate     │  └────────┴───────────┴─────┘  │   ↓                  │
│   'Main'         │                                 │ Wake                 │
└──────────────────┘                                 └──────────────────────┘
                                                        │
                                                        ▼
                                         ┌──────────────────────────┐
                                         │   Standalone Screens     │
                                         │   • Paywall (RevenueCat) │
                                         │   • DevTools (modal)     │
                                         └──────────────────────────┘
