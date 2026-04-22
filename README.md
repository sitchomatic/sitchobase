**Welcome to your Base44 project** 

**About**

View and Edit  your app on [Base44.com](http://Base44.com) 

This project contains everything you need to run your app locally.

**Edit the code in your local development environment**

Any change pushed to the repo will also be reflected in the Base44 Builder.

**Prerequisites:** 

1. Clone the repository using the project's Git URL 
2. Navigate to the project directory
3. Install dependencies: `npm install`
4. Create an `.env.local` file and set the right environment variables

```
VITE_BASE44_APP_ID=your_app_id
VITE_BASE44_APP_BASE_URL=your_backend_url

e.g.
VITE_BASE44_APP_ID=cbef744a8545c389ef439ea6
VITE_BASE44_APP_BASE_URL=https://my-to-do-list-81bfaad7.base44.app
```

Optional: for local development only, you can run against the published Base44 backend without an interactive Google login by setting a Base44 API key. When set, the SDK authenticates every request via the `api_key` header (the documented server-side SDK pattern) and the user-session flow is skipped.

```env
VITE_BASE44_API_KEY=your_base44_api_key
```

Treat the key as a secret — `.env.local` is gitignored; do not commit it. Do **not** set `VITE_BASE44_API_KEY` in any environment that produces a deployed build: Vite inlines `VITE_*` variables into the client bundle, which would make the key publicly readable.

Run the app: `npm run dev`

**Publish your changes**

Open [Base44.com](http://Base44.com) and click on Publish.

**Docs & Support**

Documentation: [https://docs.base44.com/Integrations/Using-GitHub](https://docs.base44.com/Integrations/Using-GitHub)

Support: [https://app.base44.com/support](https://app.base44.com/support)