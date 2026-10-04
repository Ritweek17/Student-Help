cd "c:\Users\ritwe\Desktop\Student Support\server"
npm run verify:admin-ingestion
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
npm run verify:admin
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
npm run verify:ingestion-schema
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
npm run verify:ingestion-pipeline
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
npm run verify:ingestion-worker
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
npm run verify:adapter-remotive
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
npm run verify:tracker
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
npm run verify:todos
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
npm run verify:goals
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

cd "c:\Users\ritwe\Desktop\Student Support"
npm run lint
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
npm run build
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

echo "ALL TESTS, LINT, AND BUILD PASSED"
