# Canvas LTI 1.3 Registration Guide

> Step-by-step instructions for registering AnatoView as an LTI 1.3 tool
> in your Canvas LMS instance.

---

## Prerequisites

| Requirement | Details |
|-------------|---------|
| Canvas role | **Root admin** or **Sub-account admin** with Developer Keys permission |
| AnatoView URL | Your production URL (e.g., `https://anatoview.youruni.edu`) or an ngrok tunnel for local dev |
| LTI keys | RSA key pair generated via `bash scripts/generate-lti-keys.sh` |

---

## Part 1: Create the Developer Key

### 1.1 Navigate to Developer Keys

1. Log in to Canvas as an admin.
2. Click **Admin** in the left sidebar.
3. Select your **root account** (or the sub-account where AnatoView will be used).
4. Click **Developer Keys** in the left menu.

### 1.2 Create a new LTI Key

1. Click the blue **+ Developer Key** button in the top-right.
2. Select **+ LTI Key** from the dropdown.

### 1.3 Configure Key Settings

Fill in the following fields:

| Field | Value |
|-------|-------|
| **Key Name** | `AnatoView` |
| **Owner Email** | Your institutional email |
| **Redirect URIs** | `https://YOUR_DOMAIN/lti/launch` |
| **Method** | `Manual Entry` |

### 1.4 LTI Tool Configuration (Manual Entry)

Enter these values in the tool configuration form:

| Field | Value |
|-------|-------|
| **Title** | `AnatoView — Virtual Dissection Lab` |
| **Description** | `Interactive anatomy dissection labs for pre-veterinary students. Supports identification, grading, and Canvas grade passback.` |
| **Target Link URI** | `https://YOUR_DOMAIN/lti/launch` |
| **OpenID Connect Initiation URL** | `https://YOUR_DOMAIN/lti/login` |
| **JWK Method** | `Public JWK URL` |
| **Public JWK URL** | `https://YOUR_DOMAIN/lti/jwks` |
| **Domain** | `YOUR_DOMAIN` (without protocol) |

### 1.5 LTI Advantage Services (Scopes)

Enable the following scopes by checking each box:

- [x] `https://purl.imsglobal.org/spec/lti-ags/scope/lineitem` — Create and manage line items
- [x] `https://purl.imsglobal.org/spec/lti-ags/scope/lineitem.readonly` — Read line items
- [x] `https://purl.imsglobal.org/spec/lti-ags/scope/result.readonly` — Read results
- [x] `https://purl.imsglobal.org/spec/lti-ags/scope/score` — Post scores (grade passback)
- [x] `https://purl.imsglobal.org/spec/lti-nrps/scope/contextmembership.readonly` — Read roster

### 1.6 Placements

Add the following placements:

#### Course Navigation Placement

| Field | Value |
|-------|-------|
| **Placement** | `Course Navigation` |
| **Target Link URI** | `https://YOUR_DOMAIN/lti/launch` |
| **Message Type** | `LtiResourceLinkRequest` |
| **Icon URL** | (optional) `https://YOUR_DOMAIN/favicon.ico` |
| **Text** | `AnatoView Labs` |

#### Assignment Selection Placement (for Deep Linking)

| Field | Value |
|-------|-------|
| **Placement** | `Assignment Selection` |
| **Target Link URI** | `https://YOUR_DOMAIN/lti/launch` |
| **Message Type** | `LtiDeepLinkingRequest` |
| **Text** | `AnatoView Lab Assignment` |

### 1.7 Save the Key

1. Click **Save** at the bottom of the form.
2. The key will appear in the Developer Keys list with state **OFF**.
3. Click the toggle to set it to **ON**.
4. **Copy the Client ID** (a long numeric string like `17000000000042`).
   You will need this for your `.env` configuration.

---

## Part 2: Install the Key in a Sub-account

### 2.1 Navigate to External Apps

1. Go to **Admin** > select your sub-account (or course).
2. Click **Settings** in the left menu.
3. Click the **Apps** tab.

### 2.2 Add AnatoView

1. Click **+ App**.
2. Set **Configuration Type** to **By Client ID**.
3. Paste the **Client ID** you copied in step 1.7.
4. Click **Submit**.
5. Canvas will show the tool details; click **Install**.

---

## Part 3: Configure AnatoView

### 3.1 Set Environment Variables

Add the Canvas configuration to your AnatoView environment:

```bash
# In .env.prod (or .env for dev)
CANVAS_BASE_URL=https://yourschool.instructure.com
LTI_CLIENT_ID=17000000000042    # The Client ID from step 1.7
```

### 3.2 Verify the Connection

1. Start AnatoView:
   ```bash
   docker compose up -d
   ```

2. Verify the JWKS endpoint is accessible:
   ```bash
   curl https://YOUR_DOMAIN/lti/jwks
   ```
   This should return a JSON Web Key Set with your public key.

3. In Canvas, navigate to a course where the tool is installed.
4. Click **AnatoView Labs** in the course navigation.
5. You should be redirected to the AnatoView dashboard.

---

## Part 4: Local Development with ngrok

For local development and testing, you can use ngrok to expose your local
AnatoView instance to Canvas.

### 4.1 Install ngrok

```bash
# macOS
brew install ngrok

# Or download from https://ngrok.com/download
```

### 4.2 Start the Tunnel

```bash
# Start AnatoView locally
make up

# In a separate terminal, start ngrok
ngrok http 80
```

ngrok will display a public URL like:
```
Forwarding  https://a1b2c3d4.ngrok-free.app -> http://localhost:80
```

### 4.3 Register with Canvas

Use the ngrok URL as `YOUR_DOMAIN` when creating the Developer Key:

| Field | Value |
|-------|-------|
| **Target Link URI** | `https://a1b2c3d4.ngrok-free.app/lti/launch` |
| **OpenID Connect Initiation URL** | `https://a1b2c3d4.ngrok-free.app/lti/login` |
| **Public JWK URL** | `https://a1b2c3d4.ngrok-free.app/lti/jwks` |

> **Note:** Free ngrok URLs change every time you restart ngrok.
> You will need to update the Developer Key each time.
> Consider using a paid ngrok plan with a stable subdomain for ongoing development.

### 4.4 Update Local Environment

```bash
# In your local .env or docker-compose override
CANVAS_BASE_URL=https://yourschool.instructure.com
LTI_CLIENT_ID=17000000000042
```

### 4.5 Test the Launch

1. In Canvas, navigate to your test course.
2. Click **AnatoView Labs** in the course navigation.
3. Canvas will POST to your ngrok tunnel.
4. You should see the AnatoView dashboard load inside the Canvas iframe.

---

## Part 5: Verifying Grade Passback

### 5.1 Create a Lab Assignment

1. In Canvas, go to **Assignments** > **+ Assignment**.
2. Set **Submission Type** to **External Tool**.
3. Click **Find** and select **AnatoView Lab Assignment**.
4. Use the deep-link picker to select a published lab.
5. Set the points possible (should match the lab's `maxPoints`).
6. Save the assignment.

### 5.2 Test as a Student

1. Log in as a test student (or use Student View).
2. Open the assignment.
3. Complete the lab and submit.
4. Return to the Canvas gradebook.
5. The student's score should appear in the gradebook.

### 5.3 Verify Sync Logs

As an instructor, check the Grade Center in AnatoView:

1. Navigate to the lab's grade center.
2. Click the sync icon on a graded attempt.
3. Check the sync log — status should be `success`.

---

## Troubleshooting

| Problem | Solution |
|---------|----------|
| "Invalid LTI launch" error | Verify `CANVAS_BASE_URL` and `LTI_CLIENT_ID` match the Developer Key |
| JWKS endpoint returns 404 | Ensure LTI initialization completed — check API logs for "LTI Provider initialized" |
| Grades not syncing | Verify AGS scopes are enabled (step 1.5) and assignment is linked via deep linking |
| "Token expired" after launch | Check server clock synchronization — Canvas JWTs have a 5-minute window |
| Blank page in Canvas iframe | Check browser console for X-Frame-Options errors — ensure Helmet allows Canvas origin |
| ngrok tunnel not working | Verify `ngrok http 80` is running and the HTTPS URL matches the Developer Key config |

---

## Reference: AnatoView LTI Endpoints

| Endpoint | Purpose |
|----------|---------|
| `GET /lti/jwks` | JSON Web Key Set — Canvas fetches AnatoView's public key |
| `POST /lti/login` | OIDC login initiation — Canvas redirects here first |
| `POST /lti/launch` | LTI launch — Canvas sends the launch JWT here |
| `POST /lti/deep-link` | Deep linking response — returns selected lab to Canvas |
