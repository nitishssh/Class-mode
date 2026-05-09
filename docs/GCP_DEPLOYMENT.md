# Google Cloud Deployment Guide

This guide describes how to deploy the PersonalLearningPro platform to Google Cloud Platform (GCP) using Cloud Run, Secret Manager, and Cloud Build.

## Prerequisites

1.  **GCP Project:** An active GCP project with billing enabled.
2.  **Google Cloud CLI:** Installed and authenticated (`gcloud auth login`).
3.  **Terraform:** Installed locally.
4.  **Firebase Project:** The project should be linked to Firebase (already configured in `.firebaserc`).

## Step 1: Provision Infrastructure

Navigate to the `terraform-gcp` directory and apply the configuration:

```bash
cd terraform-gcp
terraform init
terraform apply
```

This will create:
*   An **Artifact Registry** repository (`plp-repo`).
*   **Secret Manager** secrets for your environment variables.
*   A **Cloud Run** service (`personallearningpro`).
*   Necessary IAM permissions.

## Step 2: Configure Secrets

The Terraform script creates the secret containers, but you must manually add the values for the `latest` version of each secret in the GCP Console (Secret Manager):

*   `MONGODB_URL`: Your MongoDB Atlas connection string.
*   `GOOGLE_API_KEY`: Your Gemini API key.
*   `FIREBASE_SERVICE_ACCOUNT_JSON`: The raw JSON string of your Firebase Service Account key.
*   `SESSION_SECRET`, `JWT_SECRET`, `REFRESH_SECRET`: Secure random strings.

## Step 3: Set Up CI/CD with Cloud Build

1.  Go to the **Cloud Build** section in the GCP Console.
2.  Create a **Trigger**.
3.  Connect your repository (GitHub/GitLab/etc.).
4.  Select the `cloudbuild.yaml` file as the build configuration.
5.  **Important:** Add the following **Substitution Variables** in the trigger settings to ensure the frontend build has the correct Firebase keys:
    *   `_VITE_FIREBASE_API_KEY`
    *   `_VITE_FIREBASE_APP_ID`
    *   `_VITE_FIREBASE_MESSAGING_SENDER_ID`
    *   `_VITE_FIREBASE_MEASUREMENT_ID`

## Step 4: Initial Deployment

You can trigger a build manually from the Cloud Build console or by pushing to your main branch. Cloud Build will:
1.  Build the Docker image (injecting the Firebase build-args).
2.  Push it to Artifact Registry.
3.  Deploy it to Cloud Run.

## Step 5: Firebase Hosting (Optional)

If you want to use Firebase Hosting as the entry point (e.g., for custom domains or CDN features), update your `firebase.json` rewrites to point to the Cloud Run service:

```json
"rewrites": [
  {
    "source": "**",
    "run": {
      "serviceId": "personallearningpro",
      "region": "us-central1"
    }
  }
]
```

Then deploy with `firebase deploy --only hosting`.
