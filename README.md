# JasoosGiri — Static Supabase Edition

A lightweight, mobile-first mystery investigation website designed to work on GitHub Pages / other static hosts with Supabase for PostgreSQL, Storage, and Auth.

## Architecture

- Static frontend: HTML + CSS + vanilla JavaScript.
- Database: one `public.cases` table.
- Case content: a versioned JSON document stored in `case_data` as JSONB.
- Images: Supabase Storage bucket `case-images` (not stored inside PostgreSQL).
- Admin auth: Supabase Auth email/password.
- Admin authorization: authenticated user must have `app_metadata.role = "admin"`.
- No backend server is required for the first version.

## Local setup

1. Create a Supabase project.
2. Open Supabase SQL Editor and run `supabase.sql`.
3. Create a Supabase Auth user with email/password.
4. In Supabase Dashboard, set that user's **app_metadata** to:

```json
{
  "role": "admin"
}
```

Do not use `user_metadata.role` for authorization because users can generally update their own user metadata. The SQL policies use `app_metadata`.

5. Put your Supabase project URL and anon key in `config.js`:

```js
export const SUPABASE_CONFIG = {
  url: "https://YOUR-PROJECT.supabase.co",
  anonKey: "YOUR_SUPABASE_ANON_KEY"
};
```

Use the **anon/publishable** client key only. Never put the `service_role` secret in browser code.

6. Start a local static server from this folder. For example:

```bash
python -m http.server 8080
```

Open `http://localhost:8080`.

`file://` URLs are not recommended because ES modules and browser security rules are easier to break when opening HTML directly from the filesystem.

## GitHub Pages

This project uses relative paths and no server-side routing, so it is GitHub Pages friendly.

1. Push the repository to GitHub.
2. In repository Settings → Pages, choose **Deploy from a branch** and select the branch/folder containing these files.
3. Open the generated Pages URL.

For a production monetized website, you may prefer another static host depending on its commercial-use terms. The code itself remains static-host friendly.

## Admin workflow

Open `/admin.html`.

- Sign in.
- Paste the case JSON generated from `case-template.json`.
- Click **Validate JSON**.
- Click **Preview**.
- Select a crime-scene image. The browser resizes it to max 1600px and converts it to compressed WebP before upload.
- Enter the YouTube answer URL.
- Save the case.

The public site fetches only published cases.

## JSON contract v1

```json
{
  "schemaVersion": 1,
  "sections": [
    {
      "key": "unique_section_key",
      "name": "Bold section title",
      "description": "Text, an array, or an object",
      "type": "text"
    }
  ],
  "guessOptions": [
    { "id": "a", "name": "Suspect A" },
    { "id": "b", "name": "Suspect B" }
  ]
}
```

Supported `description` values:

- string → paragraph
- array → bullet list
- object → key/value evidence-style rows

The `type` is a presentation hint and can be extended later without changing the database schema.

## Final Guess behavior

The final guess UI is intentionally client-side for this one-table architecture. After a visitor submits one choice, it is stored in browser localStorage and the case is locked **on that device**. The YouTube answer thumbnail is then shown.

This is an engagement lock, not a security boundary. Users can clear local storage or use another browser/device. A durable server-side attempt system would require additional state and is best added later if needed.

## Image storage

Images are stored in Supabase Storage, not in PostgreSQL. The case row contains only `image_path` and `image_url`.

The admin browser compresses images to WebP before upload:

- max dimension: 1600px
- quality: ~0.78
- long-lived cache header

This keeps mobile page weight much lower than uploading the original multi-megapixel file.

## Security notes

- Never put the `service_role` key in browser JavaScript.
- The public client can only read rows where `status = 'published'`.
- Admin read/write policies depend on `auth.jwt().app_metadata.role = 'admin'`.
- The public JSON should not contain the actual solution/culprit if you want to prevent obvious client-side discovery. The answer is intended to be revealed through the YouTube URL after the final guess.
