# Contact Lens lab runbook: Windows PowerShell

One step at a time. Copy each box, paste, press Enter, check the "You should see" line. If anything differs, stop and send me the last lines.

Lab work, in your own AWS account, on your own lab instance (set its alias once per window: `$env:LENS_INSTANCE_ALIAS = "your-alias"`). The Meridian Bank instance is never touched. The helper only works on the lab instance and refuses an instance whose alias looks like the bank's.

The helper scripts are optional. The guide (`LAB-GUIDE.md`) has the by-hand console steps, which are the dependable way. Every helper command that changes something is a **dry run** until you add `--apply`.

## Step 0. Open the repo

Open **Windows PowerShell** (normal, not administrator).

```powershell
cd "$HOME\Documents\ITSM\11 GitHub Repos\amazon-connect-contact-lens-lab"
```

```powershell
Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass
```

The second line only affects this window.

You should see: no output, and the folder name in your prompt.

## Step 1. Install the tools (once)

```powershell
winget install OpenJS.NodeJS.LTS
```
```powershell
winget install Amazon.AWSCLI
```
```powershell
winget install Git.Git
```

Close PowerShell, open a new one, repeat Step 0. Check:

```powershell
node --version
aws --version
git --version
```

You should see: Node v22 or higher, aws-cli 2, git 2 or higher.

## Step 2. Offline check (touches no AWS)

```powershell
.\scripts\check-offline.ps1
```

You should see a SUMMARY where every line is PASS and the words "All stages that ran passed". If a line says FAILED, send me the first FAILED part.

## Step 3. Sign in to AWS and check the instance (read-only)

```powershell
aws sts get-caller-identity
```

You should see your own lab account. If not: `aws configure` or `aws sso login`. Make sure the region is Sydney (`ap-southeast-2`):

```powershell
$env:AWS_REGION = "ap-southeast-2"
```

Then set your Connect instance alias (the name shown in the Amazon Connect console) once in this window:

```powershell
$env:LENS_INSTANCE_ALIAS = "your-alias"
```

```powershell
.\scripts\lens.ps1 check --user YOUR_LOGIN
```

Replace `YOUR_LOGIN` with your Connect user name. You should see lines starting OK or ACTION. Fix each ACTION line (the guide, Part 2) before going on. **The call recording storage line is a stop sign.** If it says there is no call recording storage, fix it first (AWS console > Amazon Connect > your instance > Data storage > Call recordings > Edit > create a bucket, name all lowercase > Save). Without it, calls are NOT recorded and cannot be recovered.

## Step 4. Queue and agent

```powershell
.\scripts\lens.ps1 queue --user YOUR_LOGIN
```

You should see what it would do, ending with "dry run". If it looks right:

```powershell
.\scripts\lens.ps1 queue --user YOUR_LOGIN --apply
```

You should see the queue `lens-lab-queue` created and added to your routing profile. Running it again changes nothing.

## Step 5. The flow

Safest: build it by hand (guide, Part 5). Or try the helper:

```powershell
.\scripts\lens.ps1 flow
```

```powershell
.\scripts\lens.ps1 flow --apply
```

If AWS rejects it, the helper says so; use the by-hand steps. To save the JSON for the designer's Import instead:

```powershell
.\scripts\lens.ps1 flow --print
```

Then attach your phone number to `lens-lab-flow` in the console (guide, Part 5).

## Step 6. Categories (before the test calls)

```powershell
.\scripts\lens.ps1 categories
```

```powershell
.\scripts\lens.ps1 categories --apply
```

Add `--eventbridge` to either line for the ServiceNow route. If AWS refuses the format, make one rule by hand and look at how AWS stored it:

```powershell
.\scripts\lens.ps1 rule-export --name "Complaint"
```

## Step 7. Make the calls

Do guide Part 6 with the scripts in `FAKE-CALLS.md`. Remember to click **Close contact** in the CCP.

## Step 8. See what was produced (read-only)

```powershell
.\scripts\lens.ps1 results --hours 24
```

You should see your recent calls. Then look in the console: Analytics and optimization > Contact search.

## Step 9. Save your work in git (you run these)

Nothing here pushes for you. Install the GitHub Actions file:

```powershell
.\scripts\install-workflows.ps1
```

```powershell
git init -b main
git add -A
git status --short
```

`node_modules`, `.env`, `*.tfvars` and `.bak` files must not appear. If one does, stop and send me the list.

Look for secrets in what is staged:

```powershell
git grep --cached -n -E "AKIA[0-9A-Z]{16}|BEGIN (RSA|PRIVATE)|dev[0-9]{6}"
```

You should see no output. Any line is a real finding: stop and send it to me.

```powershell
git commit -m "Add Contact Lens and sentiment analysis lab"
```

On GitHub create an **empty** repository named `amazon-connect-contact-lens-lab`. Then:

```powershell
$url = "https://github.com/asvinluan/amazon-connect-contact-lens-lab.git"
git remote add origin $url
git remote -v
git push -u origin main
```

You should see the address **without** a token. Never paste an access token into the address. Keep account ids, instance ids and ServiceNow names out of the repo.

## If something goes wrong

* Close the window and restart from Step 0. Every step is safe to repeat.
* Nothing here deletes your files or touches the Meridian Bank instance.
* Stop test calls to stop the analytics charge (guide, Part 12).
