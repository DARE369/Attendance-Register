# Deploying the backend to Google Cloud Run

Replaces Fly.io. The frontend stays on Vercel; the database stays on Supabase.
Everything below runs in **Google Cloud Shell** (a terminal in the browser), so nothing needs installing.

## 1. Create the Google Cloud project (once, in the browser)

1. Go to https://console.cloud.google.com and sign in with the school's Google account.
2. Top bar → project picker → **New project**. Name: `peculiar-register`. Note the **Project ID** it shows (it may have digits added).
3. **Billing**: Menu → Billing → link a billing account (needs a card). Cloud Run's free tier covers this app's traffic.
4. **Budget alert**: Billing → Budgets & alerts → Create budget → amount `1` (USD) → alerts at 50%, 90%, 100%. You get an email if anything ever costs money.

## 2. Open Cloud Shell and get the code

Click the **`>_`** icon (top right). Then:

```bash
gcloud config set project YOUR_PROJECT_ID
gcloud services enable run.googleapis.com cloudbuild.googleapis.com artifactregistry.googleapis.com cloudscheduler.googleapis.com

git clone -b hosting/cloud-run https://github.com/DARE369/Attendance-Register.git
cd Attendance-Register/school-attendance
```

Let the build use the project's default account (new projects need this once):

```bash
PROJECT_NUMBER=$(gcloud projects describe $(gcloud config get-value project) --format='value(projectNumber)')
gcloud projects add-iam-policy-binding $(gcloud config get-value project) \
  --member="serviceAccount:${PROJECT_NUMBER}-compute@developer.gserviceaccount.com" \
  --role="roles/run.builder"
```

## 3. Fill in the settings

```bash
cp cloudrun/env.example.yaml cloudrun/env.yaml
cloudshell edit cloudrun/env.yaml
```

Fill every value (see the comments in the file), save, close the editor tab. `env.yaml` is git-ignored; never commit it.

| Value | Where to find it |
| --- | --- |
| `SUPABASE_KEY`, `SUPABASE_SERVICE_ROLE_KEY` | Supabase → project "Peculiar Shool Attenedance Register" → Project Settings → API |
| `SMTP_EMAIL`, `SMTP_PASSWORD` | The values in your local `.env` (Gmail App Password) |
| `D7_API_TOKEN`, `D7_WHATSAPP_FROM` | D7 Networks dashboard. Fly won't show its stored values. |
| `JWT_SECRET` and other secrets | New random strings: `python3 -c "import secrets; print(secrets.token_urlsafe(48))"` |

## 4. Deploy

```bash
gcloud run deploy peculiar-register-api \
  --source . \
  --region europe-west1 \
  --allow-unauthenticated \
  --env-vars-file cloudrun/env.yaml \
  --memory 512Mi --cpu 1 \
  --min-instances 0 --max-instances 2 \
  --timeout 120
```

- If asked to create an Artifact Registry repository, answer **Y**.
- The first build takes 3–5 minutes. It ends with `Service URL: https://peculiar-register-api-XXXX.europe-west1.run.app`. Copy it.
- `--allow-unauthenticated` only means browsers can reach the API; every admin endpoint still requires login.

Check it:

```bash
curl https://YOUR-SERVICE-URL/health
# {"service":"school-attendance-api","status":"ok"}
```

## 5. Keep it warm during school hours (free)

A sleeping instance takes a few seconds to wake, and the scanner gives up after 10 s. Ping it every 10 minutes, 05:00–19:59 on weekdays. Cloud Scheduler gives 3 free jobs per billing account, and idle time costs nothing.

```bash
gcloud scheduler jobs create http keep-warm \
  --location europe-west1 \
  --schedule "*/10 5-19 * * 1-5" \
  --time-zone "Africa/Lagos" \
  --uri "https://YOUR-SERVICE-URL/health" \
  --http-method GET
```

## 6. Point the frontend at it

The frontend reads the API address from `school-attendance/frontend/.env.production`. Change it to the new Service URL, commit and push to `main`; Vercel redeploys on its own.

(Alternatively set `VITE_API_BASE_URL` in Vercel → Project → Settings → Environment Variables, Production, then Redeploy. A Vercel variable overrides the file.)

## 7. Check the live site

1. Open https://peculiar-register.vercel.app and log in. The dashboard should load.
2. Scan one barcode at the gate (or have the scanner operator do it).
3. Logs: Cloud Console → Cloud Run → `peculiar-register-api` → **Logs**.

## Updating later

From Cloud Shell:

```bash
cd ~/Attendance-Register && git pull && cd school-attendance
gcloud run deploy peculiar-register-api --source . --region europe-west1 --env-vars-file cloudrun/env.yaml
```

To change one setting without rebuilding:

```bash
gcloud run services update peculiar-register-api --region europe-west1 --update-env-vars KEY=value
```

## Troubleshooting

| Symptom | Fix |
| --- | --- |
| Build fails with `PERMISSION_DENIED` | Run the `add-iam-policy-binding` command in step 2, wait a minute, deploy again. |
| Browser console shows a CORS error | `CORS_ORIGINS` must be exactly `https://peculiar-register.vercel.app` (no trailing slash). |
| Login works but emails don't send | Check `SMTP_PASSWORD` is a Gmail App Password; see Logs for `SMTP` errors. |
| First request of the morning is slow | Check the keep-warm job: Cloud Scheduler → `keep-warm` → last run status. |
