# Colocando o bot num servidor 🖥️

Com o bot num servidor, ele funciona 24h sem depender do seu computador ligado.
A opção usada aqui é a **Oracle Cloud (Always Free)**, que é grátis para sempre dentro dos limites.

Dá para fazer as partes 1 a 4 agora. Só a parte 5 precisa do WhatsApp do bot pronto.

> ⚠️ **Nunca deixe o bot rodando no computador e no servidor ao mesmo tempo.** As meninas receberiam
> tudo em dobro e as multas ficariam bagunçadas. Depois que ele estiver no servidor, não rode mais
> `npm start` no seu computador (o `npm run simular` pode, ele não conecta no WhatsApp).

---

## 1. Criar a conta na Oracle Cloud
1. Acesse **cloud.oracle.com/free** e clique em *Start for free*.
2. Em **Home Region**, escolha **Brazil East (São Paulo)**. Não dá para trocar depois.
3. Ela pede um cartão de crédito só para verificar a identidade. A conta gratuita não cobra
   enquanto você usar só recursos marcados como *Always Free*.

## 2. Criar a máquina
1. No painel: **☰ > Compute > Instances > Create instance**.
2. **Name:** `bot-casa`.
3. **Image:** clique em *Change image* e escolha **Canonical Ubuntu 22.04** (ou 24.04).
4. **Shape:** clique em *Change shape* > **Ampere** > **VM.Standard.A1.Flex**, com
   **1 OCPU** e **2 GB de memória**.
   - Por que só 2 GB: a Oracle pode apagar máquinas grátis que ficam paradas (menos de 20% de
     CPU, rede e memória por 7 dias). Com 2 GB, o bot sozinho já usa mais de 20% da memória.
   - Se aparecer *Out of capacity*, tente outro *Availability domain* ou tente de novo mais tarde.
5. **Add SSH keys:** deixe em *Generate a key pair for me* e clique em
   **Save private key**. Guarde esse arquivo `.key`: sem ele não dá para entrar na máquina.
6. Clique em **Create**. Quando ficar verde (*Running*), copie o **Public IP address**.

Não precisa abrir nenhuma porta: o bot só faz conexões de saída para o WhatsApp.

## 3. Preparar a chave no Windows
No PowerShell (troque o nome do arquivo pelo que você baixou):
```powershell
mkdir $HOME\.ssh -Force
move $HOME\Downloads\ssh-key-*.key $HOME\.ssh\bot-casa.key
icacls $HOME\.ssh\bot-casa.key /inheritance:r /grant:r "$($env:USERNAME):(R)"
```
O último comando deixa a chave só com você. Sem isso, o `ssh` se recusa a usar o arquivo.

## 4. Mandar o bot para o servidor e instalar
No PowerShell, dentro da pasta `programinhas` (troque `IP` pelo IP da máquina):
```powershell
tar -czf bot-casa.tgz --exclude=bot-casa/node_modules --exclude=bot-casa/dados bot-casa
scp -i $HOME\.ssh\bot-casa.key bot-casa.tgz ubuntu@IP:~
ssh -i $HOME\.ssh\bot-casa.key ubuntu@IP
```
Na primeira vez ele pergunta se confia no servidor: digite `yes`.

Agora você está **dentro do servidor**. Rode:
```bash
tar -xzf bot-casa.tgz && cd bot-casa
sed -i 's/\r$//' servidor/*.sh
bash servidor/instalar.sh
```
Leva uns 5 a 10 minutos. No fim aparece **✅ Instalação concluída.**

> O pacote leva junto o seu `config.js`, que não vai para o GitHub. Se em vez disso você clonar o
> repositório direto no servidor (`git clone`), mande o `config.js` separado:
> `scp -i $HOME\.ssh\bot-casa.key bot-casa\config.js ubuntu@IP:~/bot-casa/`

## 5. Conectar o WhatsApp do bot (quando o número estiver pronto)
1. Confira o `config.js` (principalmente `grupoNome` e a chave Pix). Para editar no servidor:
   `nano config.js`, salve com Ctrl+O e saia com Ctrl+X. Ou edite no computador e mande de novo
   (seção "Atualizar o bot").
2. Rode:
   ```bash
   cd ~/bot-casa && bash servidor/conectar.sh
   ```
3. Escaneie o QR Code com o **WhatsApp Business do bot** > Configurações > Dispositivos conectados.
4. Quando aparecer **Bot conectado!**, aperte **Ctrl+C**. O bot passa a rodar sozinho em segundo
   plano e religa sozinho se cair ou se o servidor reiniciar.

Pronto: pode fechar o PowerShell e desligar o computador. 🎉

---

## Comandos do dia a dia (dentro do servidor)
| Comando | Para quê |
|---|---|
| `pm2 status` | Ver se o bot está rodando (*online*) |
| `pm2 logs casa` | Ver o que ele está fazendo agora (Ctrl+C para sair) |
| `pm2 restart casa` | Reiniciar o bot |
| `cd ~/bot-casa && bash servidor/conectar.sh` | Escanear o QR de novo, se o WhatsApp desconectar |

Para entrar no servidor: `ssh -i $HOME\.ssh\bot-casa.key ubuntu@IP`

## Atualizar o bot (quando mudarmos o código)
No PowerShell, dentro de `programinhas`:
```powershell
tar -czf bot-casa.tgz --exclude=bot-casa/node_modules --exclude=bot-casa/dados bot-casa
scp -i $HOME\.ssh\bot-casa.key bot-casa.tgz ubuntu@IP:~
ssh -i $HOME\.ssh\bot-casa.key ubuntu@IP "tar -xzf bot-casa.tgz && cd bot-casa && sed -i 's/\r$//' servidor/*.sh && npm ci --omit=dev && pm2 restart casa"
```
A pasta `dados` (multas, pagamentos, sessão do WhatsApp) fica fora do pacote, então nada se perde.

## Backups
Todo dia às 3h o servidor guarda uma cópia dos dados (multas, pagamentos, comprovantes e
contestações) em `~/backups-bot`, por 30 dias. Para baixar para o seu computador de vez em quando:
```powershell
scp -i $HOME\.ssh\bot-casa.key "ubuntu@IP:~/backups-bot/*" .
```
