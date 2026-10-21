import {createApp} from '../server/app.mjs';
const port=Number(process.env.PORT||5173),host=process.env.HOST||'127.0.0.1';
const app=await createApp();
app.server.on('error',error=>{console.error(`启动失败：${error.message}。可设置 PORT 更换端口。`);process.exitCode=1;});
app.server.listen(port,host,()=>console.log(`Halloween Bingo: http://${host}:${port}`));
for(const signal of ['SIGINT','SIGTERM'])process.on(signal,async()=>{await app.close();process.exit(0);});
