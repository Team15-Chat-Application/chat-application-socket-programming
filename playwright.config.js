const {defineConfig}=require('@playwright/test');
module.exports=defineConfig({testDir:'./e2e',workers:1,timeout:45000,reporter:[['list'],['json',{outputFile:'reports/browser-results.json'}]],
  use:{baseURL:'http://127.0.0.1:31337',viewport:{width:1280,height:800},trace:'retain-on-failure',screenshot:'only-on-failure'},
  webServer:{command:'node scripts/serve-test.js',url:'http://127.0.0.1:31337/api/health',reuseExistingServer:false,timeout:20000}});
