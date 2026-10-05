# Nourish & Nest (with accounts)

Recipe discovery and meal planning with real user accounts. Express + MongoDB backend; vanilla JS front end; recipes from [Spoonacular](https://spoonacular.com/food-api).

## Run it

1. Install Node 18+ and MongoDB (local) or create a free [MongoDB Atlas](https://www.mongodb.com/atlas) cluster.
2. `npm install`
3. `cp .env.example .env` and set `MONGODB_URI`, `SESSION_SECRET`
   (generate one: `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"`) and `SPOONACULAR_API_KEY`
   (free key from the [Spoonacular console](https://spoonacular.com/food-api/console#Dashboard)). The `.env.example` value is a placeholder: the site still starts with it, but live recipes show a friendly "not configured" message until you swap in your real key.
4. `npm start`, then open http://localhost:3000

Open the site through the server (not by double-clicking the HTML files), otherwise the API calls won't work.

## How recipes work (Spoonacular)

- The browser never sees your API key. It calls our own `/api/recipes/...` endpoints (`routes/recipes.js`), which call Spoonacular's `complexSearch` (plus `random`, `information` and `findByIngredients`) with `SPOONACULAR_API_KEY`.
- **Trending first:** the Recipes page opens with Spoonacular's most popular recipes (`sort=popularity`). Spoonacular has no "date added" sort, so "recent" here means popular right now. Category chips: Trending, Breakfast, Main course, Soup, Salad, Appetizer, Side dish, Snack, Dessert, Vegetarian, Vegan, Gluten free, Seafood.
- **Real nutrition:** calories, protein and fibre per serving come from Spoonacular. Recipes without that data fall back to the old category estimates (shown with a "≈").
- **Quota saver:** search results are cached in memory (6 h) and recipe details (24 h); the API is rate limited per IP. Spoonacular's free plan has a daily points limit, and when it runs out the site falls back to its built-in recipes.

## How it works

- **Accounts:** `POST /api/auth/register`, `/login`, `/logout`. Passwords are hashed with bcrypt; sessions are stored in MongoDB and sent as an httpOnly cookie.
- **Per-user data:** saved recipes, calendar meals, shopping list, weekly plan and recent searches live on the user's document. After login `GET /api/data` loads everything; every change is saved with `PUT /api/data/:key`.
- **Profile:** `GET /api/me`, `PUT /api/profile` (name, dietary preference, calorie goal), `PUT /api/profile/password`.
- **Guests** can browse and search recipes; saving or planning sends them to the login page. Saved, Planner, Shopping list and Profile require login.

## Account menu, avatars and Calorie Ring

- Click the round avatar (top right) for Manage account, Saved recipes, Meal planner, Shopping list, Dark mode and Log out.
- **Manage account** lets you pick an emoji and colour for your avatar, set a dietary preference and a daily calorie goal.
- **Daily Calorie Ring** (Planner page): meals added with the + button keep their estimated calories; the ring shows the selected day's total against your goal.
- Dark mode is remembered per browser.

## Smart features

- **Plan my week** (Planner page): fills the Sunday to Saturday week of the selected date with recipes that match your dietary preference and aim for your calorie goal. No repeats; can keep meals you already planned; has Undo.
- **Week → shopping list** (Planner page): gathers the ingredients of that week's meals, merges duplicates and adds up amounts, and skips items already on your list.
- **Pantry match** (`pantry.html`): add the ingredients you have, get recipes ranked by how much you already have, see what's missing and add it to your shopping list. Your pantry is saved to your account.

Notes: Vegetarian, Vegan, Pescatarian, Gluten-free and Dairy-free planning use Spoonacular's own diet and intolerance filters, but always check labels if you have an allergy. Plan my week uses one search per meal type, then fills the week from the results. Plans saved before this change used TheMealDB ids; those older entries keep their saved ingredients but can't be re-fetched.

## Project layout

- `server.js`: app setup, security headers, sessions
- `routes/auth.js`, `routes/user.js`: API
- `models/User.js`: MongoDB schema
- `public/`: the website. `api.js` is the data layer that replaced `localStorage`.

## Deploying

Set `NODE_ENV=production` (enables secure cookies, so serve over HTTPS), a strong `SESSION_SECRET`, and your Atlas `MONGODB_URI`. Works on Render, Railway, Fly.io, etc.

Nutrition numbers come from Spoonacular's data and are planning estimates, not medical advice.

## Fastest way: Docker (no MongoDB install)

    docker compose up --build

Run it with your key: `SPOONACULAR_API_KEY=your-real-key docker compose up --build`. Then open http://localhost:3000. Data persists in the `mongo-data` volume.
Change `SESSION_SECRET` in `docker-compose.yml` before using it for real.

## Put it online (free tier)

1. Create a free MongoDB Atlas cluster, add a database user, allow network access (0.0.0.0/0 for testing), and copy the connection string.
2. Push this folder to GitHub.
3. On Render.com: New → Web Service → pick the repo. Build command `npm install`, start command `npm start`.
4. Add environment variables: `MONGODB_URI` (Atlas string), `SESSION_SECRET` (long random), `SPOONACULAR_API_KEY`, `NODE_ENV=production`.
5. Deploy. Render gives you an HTTPS URL, which is what secure cookies need.
