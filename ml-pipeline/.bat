@echo off
title SubtitleBot Menu
color 0A

:menu
cls
echo ================================
echo        SUBTITLEBOT MENU
echo ================================
echo.
echo 1 - Importar novelas para o dataset
echo 2 - Gerar metadata e manifest
echo 3 - Gerar training pairs
echo 4 - Auditar training pairs
echo 5 - Rodar pipeline de limpeza de SRT
echo 6 - Sair
echo.
set /p opt=Escolha uma opcao: 

if "%opt%"=="1" goto import
if "%opt%"=="2" goto metadata
if "%opt%"=="3" goto pairs
if "%opt%"=="4" goto audit
if "%opt%"=="5" goto pipeline
if "%opt%"=="6" goto end

echo.
echo Opcao invalida.
pause
goto menu

:import
cls
echo Rodando importacao...
py C:\SubtitleBot\01_import_novels_to_dataset.py
pause
goto menu

:metadata
cls
echo Gerando metadata...
py C:\SubtitleBot\build_dataset_metadata.py
pause
goto menu

:pairs
cls
echo Gerando training pairs...
py C:\SubtitleBot\build_training_pairs.py
pause
goto menu

:audit
cls
echo Auditando training pairs...
py C:\SubtitleBot\audit_training_pairs.py
pause
goto menu

:pipeline
cls
echo Rodando pipeline de limpeza...
py C:\SubtitleBot\run_subtitle_pipeline.py
pause
goto menu

:end
exit