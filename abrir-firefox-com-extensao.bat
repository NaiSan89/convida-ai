@echo off
rem Abre um Firefox separado (perfil proprio da extensao) com a extensao carregada.
rem Nao mexe no seu perfil principal: pode usar o seu Firefox normal ao mesmo tempo.
rem Na primeira vez, faca login no Facebook nesta janela.
rem Mantenha esta janela preta aberta enquanto usar a extensao.
cd /d "%~dp0"
npx --yes web-ext@8 run --source-dir . ^
  --firefox "C:\Program Files\Mozilla Firefox\firefox.exe" ^
  --firefox-profile "%APPDATA%\Mozilla\Firefox\Profiles\convida-ai" ^
  --profile-create-if-missing --keep-profile-changes ^
  --pref widget.windows.window_occlusion_tracking.enabled=false ^
  --start-url "https://www.facebook.com/" --no-input
