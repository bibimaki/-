# React + TypeScript + Vite

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Oxc](https://oxc.rs)
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/)

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the ESLint configuration

If you are developing a production application, we recommend updating the configuration to enable type-aware lint rules:

```js
export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      // Other configs...

      // Remove tseslint.configs.recommended and replace with this
      tseslint.configs.recommendedTypeChecked,
      // Alternatively, use this for stricter rules
      tseslint.configs.strictTypeChecked,
      // Optionally, add this for stylistic rules
      tseslint.configs.stylisticTypeChecked,

      // Other configs...
    ],
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.node.json', './tsconfig.app.json'],
        tsconfigRootDir: import.meta.dirname,
      },
      // other options...
    },
  },
])

```

You can also install [eslint-plugin-react-x](https://npmx.dev/package/eslint-plugin-react-x) and [eslint-plugin-react-dom](https://npmx.dev/package/eslint-plugin-react-dom) for React-specific lint rules:

```js
// eslint.config.js
import reactX from 'eslint-plugin-react-x'
import reactDom from 'eslint-plugin-react-dom'

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      // Other configs...
      // Enable lint rules for React
      reactX.configs['recommended-typescript'],
      // Enable lint rules for React DOM
      reactDom.configs.recommended,
    ],
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.node.json', './tsconfig.app.json'],
        tsconfigRootDir: import.meta.dirname,
      },
      // other options...
    },
  },
])

```


## เลือกบรรยากาศห้อง
หน้า “พื้นที่ส่วนตัว” มีฉากให้เลือก 4 แบบ โดยไฟล์ภาพอยู่ที่ `public/images/room-backgrounds/` การเลือกห้องจะบันทึกใน `localStorage` และภาพเดียวกันจะแสดงในแบนเนอร์หน้าแรก

## Group task review and Telegram beta notifications

- Group-task progress is capped at 99% until the assigned member presses **ส่งงานให้ตรวจ** and the room host approves it in **ระบบตรวจงานของโฮสต์**. Only host approval marks the task 100% complete.
- Telegram notifications are opt-in. Users enable them in **การตั้งค่า → Telegram แจ้งเตือน (ทดลองใช้)** and enter their Telegram Chat ID. Only accounts with an enabled `telegram_subscriptions` row receive messages.
- Run `docs/telegram-beta-setup.sql` in the Supabase SQL editor.
- Configure these server-side environment variables in Vercel (never expose the bot token or service-role key in `VITE_*` variables):
  - `SUPABASE_URL` (or existing `VITE_SUPABASE_URL`)
  - `SUPABASE_SERVICE_ROLE_KEY`
  - `TELEGRAM_BOT_TOKEN`
- The user must start a chat with the Telegram bot before the test message can be delivered. After deployment, save the Chat ID and enable the opt-in checkbox in Aevora settings.
- Event notifications include room joins, task assignment/division, comments, help requests, work submitted for host review, and host approval.
