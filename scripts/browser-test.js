const path=require('node:path');
process.env.PLAYWRIGHT_BROWSERS_PATH ||= path.resolve('.cache/playwright');
const result=require('node:child_process').spawnSync(process.execPath,[require.resolve('@playwright/test/cli'),...process.argv.slice(2)],{stdio:'inherit',env:process.env});
process.exitCode=result.status??1;
