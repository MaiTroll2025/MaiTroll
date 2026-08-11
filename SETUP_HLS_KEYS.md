# Setup HLS Egress Keys for Supabase Storage

The HLS Egress system needs to write video segments to your Supabase Storage "hls" bucket. To do this, it requires S3-compatible credentials.

## 1. Get S3 Credentials from Supabase

1. Go to your **Supabase Dashboard** -> **Project Settings**.
2. Click on **Storage** in the sidebar.
3. Scroll down to **S3 Access Keys**.
4. Click **Generate new key**.
5. Copy the **Access Key ID** and **Secret Access Key**.

## 2. Set Environment Variables

You need to set these variables for your Edge Functions. Run the following commands in your terminal (replace values with your actual keys):

```bash
npx supabase secrets set S3_BUCKET=hls
npx supabase secrets set S3_REGION=us-east-1
npx supabase secrets set S3_ENDPOINT=https://gejtbllazzighxwxudyu.supabase.co/storage/v1/s3
npx supabase secrets set S3_ACCESS_KEY=<YOUR_ACCESS_KEY_ID>
npx supabase secrets set S3_SECRET_KEY=<YOUR_SECRET_ACCESS_KEY>
```

> **Note:** Replace `<YOUR_PROJECT_REF>` with your Supabase project ID (found in the URL: `https://app.supabase.com/project/<project-ref>`).
> For `S3_REGION`, Supabase usually uses `us-east-1` for S3 compatibility, or your specific region. You can check the S3 endpoint documentation in Supabase.

## 3. Verify LiveKit Credentials

Also ensure your LiveKit credentials are set:

```bash
npx supabase secrets set LIVEKIT_URL=<your-livekit-url>
npx supabase secrets set LIVEKIT_API_KEY=<your-api-key>
npx supabase secrets set LIVEKIT_API_SECRET=<your-api-secret>
```

## 4. Redeploy Functions

After setting secrets, redeploy the webhook function:

```bash
npx supabase functions deploy livekit-webhooks --no-verify-jwt
```
