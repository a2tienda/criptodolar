@echo off
cd /d "D:\proyectos opencode\dolar_cp"

echo Inicializando Git...
git init
git add .
git commit -m "Sitio funcionando"

echo.
echo ****************************************
echo CREA UN REPO EN GITHUB:
echo 1. Ve a: https://github.com/new
echo 2. Nombre: dolar-cp
echo 3. NO marques nada, dejalo en blanco
echo 4. Click "Create repository"
echo 5. Copia la URL (ej: https://github.com/tuusuario/dolar-cp.git)
echo ****************************************
echo.

set /p REPO_URL=Pega la URL del repo: 

git remote add origin %REPO_URL%
git branch -M main
git push -u origin main

echo.
echo ****************************************
echo SUBE A NETLIFY:
echo 1. Ve a: https://app.netlify.com
echo 2. "Add new site" > "Import from Git"
echo 3. Elige GitHub y autoriza
echo 4. Selecciona el repo "dolar-cp"
echo 5. Build: npm run build | Publish: dist
echo 6. Click "Show advanced" > "New variable"
echo    Key: GEMINI_API_KEY
echo    Value: (tu API key de Google)
echo 7. Click "Deploy site"
echo ****************************************
pause