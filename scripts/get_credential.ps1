Add-Type -AssemblyName System.Security;

$target = "LegacyGeneric:target=Supabase CLI:supabase";

# Use Windows Credential Manager API
$credential = New-Object -ComObject "Microsoft.CredentialManager" -ErrorAction SilentlyContinue;
if ($credential) {
    $password = $credential.GetCredential($target);
    if ($password) {
        Write-Output "Found credential for: $target";
        Write-Output "Username: $($password.UserName)";
        Write-Output "Password: $($password.Password)";
    } else {
        Write-Output "No credential found for: $target";
    }
} else {
    Write-Output "Could not create CredentialManager COM object";
}
