@echo off
chcp 65001 >nul
title Ortam Sade
cd /d "%~dp0"
if not defined ORTAM_YENIDEN set ORTAM_AC=1
echo Ortam Sade baslatiliyor; tarayicida kendiliginden acilacak.
echo Bu pencere acik kaldikca uygulama calisir. Kapatinca uygulama durur.
echo.
if exist "runtime\node.exe" (set "NODE=runtime\node.exe") else (set "NODE=node")
"%NODE%" server\start.mjs
if errorlevel 1 (echo. & echo Ortam Sade baslatilamadi. Node.js bulunamadiysa GitHub Releases sayfasindaki paketli surumu indirin. & pause)
