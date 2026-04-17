@echo off
echo Initializing Git repo in islamic_school...
cd islamic_school
git init
git add .
git commit -m "Complete Islamic School Management System upload - latest fixes, README, docs"
git branch -M main
git remote add origin https://github.com/BLUES-20/islamic-school-management.git
git pull origin main --allow-unrelated-histories
git push -u origin main
echo.
echo Success! Check https://github.com/BLUES-20/islamic-school-management
pause
