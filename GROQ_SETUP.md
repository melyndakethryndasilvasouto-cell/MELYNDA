# Ativar o Guia Bíblico com Groq

O jogo e todos os modos contra o computador funcionam sem internet. A Groq é usada somente no recurso opcional **Guia Bíblico**.

Abra um PowerShell na conta do Windows que executa o jogo e cole este bloco. A chave será solicitada de forma oculta e será salva no ambiente do usuário, fora dos arquivos do projeto:

```powershell
$groqSecret = Read-Host "Cole sua GROQ_API_KEY" -AsSecureString
$groqPtr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($groqSecret)
try {
  $groqValue = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($groqPtr)
  [Environment]::SetEnvironmentVariable("GROQ_API_KEY", $groqValue, "User")
  $env:GROQ_API_KEY = $groqValue
  Write-Host "GROQ_API_KEY salva no ambiente do usuário."
}
finally {
  [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($groqPtr)
  Remove-Variable groqValue, groqSecret, groqPtr -ErrorAction SilentlyContinue
}
```

Depois, encerre normalmente o terminal que executa o Vite e abra outro terminal para iniciar `npm run dev`. Um servidor que já estava aberto não recebe variáveis novas.

Para conferir sem exibir a chave:

```powershell
[bool][Environment]::GetEnvironmentVariable("GROQ_API_KEY", "User")
```

Para remover a chave do ambiente do usuário:

```powershell
[Environment]::SetEnvironmentVariable("GROQ_API_KEY", $null, "User")
```

Opcionalmente, o modelo pode ser alterado com `GROQ_MODEL`. O padrão validado é `openai/gpt-oss-20b`.

## Cloudflare Pages

Em produção, não use uma variável `VITE_*`: ela seria incorporada ao JavaScript público. Cadastre `GROQ_API_KEY` como **Secret** em **Workers & Pages → projeto → Settings → Variables and Secrets** e faça uma nova implantação. A Pages Function acessa a chave apenas no servidor por `context.env.GROQ_API_KEY`.
