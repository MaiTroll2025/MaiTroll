$functions = @(
    "add-card",
    "admin",
    "admin-actions",
    "agora-stream",
    "agora-token",
    "agora-walkie-token",
    "battles",
    "calc_post_earnings",
    "capture-content",
    "charge-stored-card",
    "create-paypal-order",
    "create-square-checkout",
    "customer-service-admin",
    "delete-account",
    "employee-payroll",
    "generate-ad",
    "get-how-to-video-url",
    "ghost-mode",
    "global-ticker-notify",
    "live",
    "livekit-token",
    "moderation-actions",
    "notify-stream-live",
    "officer-actions",
    "payments",
    "paypal-complete-order",
    "paypal-create-order",
    "paypal-health",
    "paypal-payout",
    "process-payout-batch",
    "publish-social",
    "push-notifications",
    "redeem-maitalent-promo",
    "send-message",
    "sendEmail",
    "social-oauth-init",
    "stream-health-monitor",
    "stream-stale-cleanup",
    "streams-maintenance",
    "toggle-ghost-mode",
    "trollcourt-ai",
    "verify-paypal-payment",
    "verify-square-payment"
)

$projectRef = "gejtbllazzighxwxudyu"
$success = 0
$failed = 0

foreach ($func in $functions) {
    Write-Host "Deploying $func..."
    $result = supabase functions deploy $func --project-ref $projectRef --yes 2>&1
    if ($LASTEXITCODE -eq 0) {
        Write-Host "  OK: $func deployed"
        $success++
    } else {
        Write-Host "  FAILED: $func"
        Write-Host $result
        $failed++
    }
}

Write-Host "Deployment complete: $success succeeded, $failed failed"
