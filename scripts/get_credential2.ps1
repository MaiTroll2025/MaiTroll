Add-Type -TypeDefinition @"
using System;
using System.Runtime.InteropServices;
using System.Text;

public class CredentialManager {
    [DllImport("advapi32.dll", EntryPoint = "CredEnumerateA", CharSet = CharSet.Ansi)]
    private static extern bool CredEnumerate(string filter, int flag, out int count, out IntPtr credentials);

    [DllImport("advapi32.dll", EntryPoint = "CredFree")]
    private static extern bool CredFree(IntPtr credential);

    [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Ansi)]
    private struct CREDENTIAL {
        public uint Flags;
        public uint Type;
        public string TargetName;
        public string Comment;
        public System.Runtime.InteropServices.ComTypes.FILETIME LastWritten;
        public uint CredentialBlobSize;
        public IntPtr CredentialBlob;
        public uint Persist;
        public uint AttributeCount;
        public IntPtr Attributes;
        public string TargetAlias;
        public string UserName;
    }

    public static string GetPassword(string target) {
        int count;
        IntPtr credentials;
        
        if (!CredEnumerate(null, 1, out count, out credentials)) {
            return "Failed to enumerate credentials";
        }
        
        for (int i = 0; i < count; i++) {
            IntPtr cred = Marshal.ReadIntPtr(credentials, i * IntPtr.Size);
            CREDENTIAL credential = (CREDENTIAL)Marshal.PtrToStructure(cred, typeof(CREDENTIAL));
            
            if (credential.TargetName != null && credential.TargetName.Contains(target)) {
                string password = Marshal.PtrToStringAnsi(credential.CredentialBlob, (int)credential.CredentialBlobSize);
                CredFree(cred);
                return password;
            }
        }
        
        CredFree(credentials);
        return "Not found";
    }
}
"@

$target = "Supabase"
$password = [CredentialManager]::GetPassword($target)
Write-Output "Password for $target : $password"
