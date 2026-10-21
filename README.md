# Halloween Bingo · 午夜糖果派对

[简体中文](#简体中文) | [English](#english)

## 简体中文

基于 LittleJS 的可玩双模式游戏，含独立权威房间服务。无需安装 npm 依赖。

## 启动

需要 Node.js 20 或更新版本：

```powershell
npm run dev
```

打开 http://127.0.0.1:5173 。使用 Ctrl+C 停止。端口占用时，先执行 `$env:PORT=5174`。

当前默认仅在本机运行，未发布到公网。朋友需要能够访问同一个游戏服务器；`127.0.0.1` 邀请链接只能用于本机。需要同一局域网的手机参与时，可自行设置监听地址：

```powershell
$env:HOST="0.0.0.0"
npm run dev
```

随后用本机局域网 IP（例如 `http://192.168.1.20:5173`）打开游戏并复制邀请。请以实际 IP 为准；设备需要在同一网络且系统允许该端口访问。异地朋友房需要将此 Node 服务运行在可访问的服务器地址上。

同一浏览器的多个标签页共享身份；本机测试两位玩家时，使用不同浏览器或独立隐私窗口。真实多人由服务器同步，不使用假玩家或前端模拟对手。

## 两种模式

| 模式 | 卡片及开奖 | 最长时间 |
| --- | --- | --- |
| 经典数字 | 1–75，B/I/N/G/O 每列分别为 1–15、16–30、31–45、46–60、61–75；个人卡 24 个不同号码＋中心 FREE | 75 轮，537 秒（8 分 57 秒） |
| 万圣图案 | 24 种图案，每张卡包含同一集合，位置不同＋中心 FREE | 24 轮，180 秒 |

共同规则：3 秒开局倒数，每轮公布一个新项目并开放 7 秒标记。历史开奖可以补点。5 行、5 列、2 条主对角线，共 12 条有效线；至少两条线达标。轮末统一判胜，同轮达标者并列获胜。第 6、12、18 轮末无人获胜时，各有 3 秒无竞技影响的事件；之后不额外插入事件。

玩家操作是“看开奖 → 自己找格子 → 点击盖章”。只有中心 FREE 自动点亮；开奖不会自动标记，也不会在个人卡片中高亮答案。玩家点击已开奖项目并收到服务端确认后，格子才出现橙金印章，并播放短促盖章反馈、更新手动盖章数。临近连线只提示需要等待开奖还是有漏点可补，不直接报出目标名称或位置。误点不扣分、不代选其他格子。

数字模式按用户后续选择采用经典 75 号规则，因此不再承诺三分钟内结束。

## 已实现

- 双模式朋友房（2–8 人）和单人练习。
- 邀请链接、房间码、昵称、预设头像、准备、房主转交、等待玩家移出。
- 服务端公平洗牌、图案布局去重、数字分列、卡片隐私与开奖顺序保密。
- 标记确认、补点、重复点击幂等、误点提示、自动识别连线、轮末并列结算。
- 幽灵来访、糖果雨、坩埚冒泡；事件不能标记，不计入下一轮操作时间。
- 断线/后台恢复、保留原卡与标记、不补额外操作时间、主动退出放弃资格。
- 晚加入等待下局、全员退出中止、房间闲置超时、结算后再来一局。
- 装饰糖果、三种装饰解锁；按模式分别保存练习最佳轮数。
- 手机竖屏与电脑横屏布局、全历史、有限频快捷表情、两种临近连线提示。
- 声音与减少动画设置，以及 LittleJS 环境粒子、事件糖果和音效。

## 判定与奖励

- 截止时刻及之后收到的标记不属于旧轮。请求携带轮次与局 ID，不会自动排队到后轮；后续正常轮需手动补点。
- 断线继续保留资格；主动退出立即失去本局资格和糖果。轮末前主动退出的达标者不进入胜者名单。
- 多人至少确认 4 个不同项目、且发生于至少 2 个轮次：参与 +10，获胜再 +20。并列每人同奖。
- 单人练习仅北京时间当日首次成功 +2（两种模式共用每日奖励次数），失败与重复成功无糖果。
- 全员主动退出中止，不发奖励；未主动退出的断线玩家按已确认记录正常结算。
- 等待房间连续 10 分钟无房间操作后解散；结束记录保留 10 分钟。普通状态轮询不会延长房间寿命。

## 数据与运行边界

服务端将身份、糖果、装饰、房间和当前局保存到 `.data/state.json`，采用临时文件替换写入；`.data/` 被 Git 忽略且不对静态请求开放。不要公开此目录或把数据文件提交到仓库。

刷新、网络重连与进程重启均恢复原有截止时间；服务器停机期间也不自动延长对局。身份凭证存储于当前浏览器，清除浏览器存储会建立新身份。首版没有账号跨设备登录、公开匹配或生产级多进程存储；运行一个权威 Node 进程。

## 检查

```powershell
npm run check
npm test
```

19 项自动测试覆盖随机卡片合法性、数字列范围、完整时间线、双模式开奖和轮询不自动标记、补点归属、一次多线、同轮并列、事件与截止边界、退出/断线、隐私、房间容量、奖励幂等和落盘恢复。HTTP 集成测试使用独立客户端与可控测试时钟，正式服务没有修改开奖或加速时间的接口。

浏览器实测：经典数字开奖与补点、图案模式、24 轮无人获胜结算、刷新恢复；检查了 360×800 与 1440×900 布局。新增双模式实际点击验证：连续开奖不自动盖章、不自动高亮答案；手动点击只增加一格，误点不增加，刷新后保留已确认印章。360×800 下卡片、盖章反馈及最近开奖可在一屏查看。未进行跨公网或真实高延迟网络压测。

## 文件

- `src/app.js`：页面、房间与游戏交互、状态同步。
- `src/rules.js`：图案、经典号码、12 条线及临近提示。
- `src/effects.js`：LittleJS 粒子、事件和合成音效。
- `src/style.css`：两套响应式布局。
- `server/game.mjs`：权威游戏状态机及轮末判定。
- `server/app.mjs`：身份、房间接口、奖励与持久化。
- `scripts/serve.mjs`：服务入口。
- `tests/`：规则与真实 HTTP 接口测试。
- `assets/`：生成的月夜背景、24 图案透明图集及生成提示。
- `vendor/littlejs/`：本地运行包、类型与许可证。
- `upstream/LittleJS/`：保留独立历史的官方源码浅克隆，外层 Git 忽略。

## 引擎与美术来源

LittleJS 官方仓库：https://github.com/KilledByAPixel/LittleJS 。运行包版本 1.27.2；固定提交 `cdcbef463d889d24dee37f481c2ea5f49bf7fcf5`。引擎文件保持原样，许可证随 `vendor/littlejs/` 保存。

美术使用内置 imagegen，根据用户提供的两张参考图方向生成；具体保存路径、图集顺序与提示见 `assets/README.md` 和 `assets/ART-PROMPTS.md`。

## 开源许可

本项目采用 [MIT 许可证](LICENSE) 开源。LittleJS 同样采用 MIT 许可证，其原始版权及许可声明保留在 [`vendor/littlejs/LICENSE`](vendor/littlejs/LICENSE) 和 [`vendor/littlejs/COPYRIGHT.txt`](vendor/littlejs/COPYRIGHT.txt) 中。

## English

**Halloween Bingo: Midnight Candy Party** is a playable LittleJS game with two modes, private multiplayer rooms, solo practice, and an authoritative Node.js server. No npm dependencies need to be installed. The current game interface is in Simplified Chinese; this section provides English documentation.

### Getting started

Requires Node.js 20 or later:

```sh
npm run dev
```

Open [http://127.0.0.1:5173](http://127.0.0.1:5173). Press Ctrl+C to stop the server. To use another port in PowerShell, run `$env:PORT=5174` before starting it.

The server listens on the local machine by default. It is not deployed to the public internet, and an invitation containing `127.0.0.1` only works on the same machine. To play with phones or computers on the same local network, set the listening address in PowerShell:

```powershell
$env:HOST="0.0.0.0"
npm run dev
```

Then open the game using your computer's actual LAN IP, for example `http://192.168.1.20:5173`, and copy the invitation from that address. Devices must share the network, and the server port must be reachable. Remote friends need a deployment of this Node.js server at an address they can access.

Tabs in the same browser share a player identity. To test two players locally, use separate browsers or isolated browser profiles/private sessions. Multiplayer is synchronized by the server; opponents are real players, not simulated bots.

### Game modes and rules

| Mode | Card and draw pool | Maximum duration |
| --- | --- | --- |
| Classic numbers | Numbers 1–75; B/I/N/G/O columns use 1–15, 16–30, 31–45, 46–60, and 61–75 respectively. Each card has 24 distinct numbers and a central FREE space. | 75 rounds, 537 seconds (8 minutes 57 seconds) |
| Halloween icons | 24 distinct Halloween icons. Every card contains the same set in a different arrangement, plus a central FREE space. | 24 rounds, 180 seconds |

A game starts with a three-second countdown. Each round reveals one new item and allows seven seconds for marking. Draws do not repeat. Players can mark previously drawn items during later normal rounds.

There are 12 valid lines: five rows, five columns, and the two main diagonals. Completing at least two different lines qualifies a player to win. Results are checked at the end of each round. Everyone who qualifies in the earliest winning round shares the win, regardless of click order or additional completed lines. If nobody qualifies by the final round, the game ends with no winner.

The interaction is **watch the draw → find the space yourself → click to stamp**. Only FREE is marked automatically. Draws neither mark matching spaces nor highlight their locations. A manual stamp appears only after server confirmation, with a short animation, sound, and an updated manual stamp count. Near-line hints distinguish an undrawn missing item from a drawn item that still needs marking, without revealing its name or location. Incorrect clicks do not deduct points or mark another space.

After rounds 6, 12, and 18, a three-second decorative event plays only if there is no winner. Cards cannot be marked during events; each following round still receives its full seven seconds. Classic numbers can take longer than three minutes because they use the full 75-number pool.

### Included features

- Private rooms for 2–8 players and solo practice in both modes.
- Invitation links, room codes, nicknames, preset avatars, ready states, host transfer, and removal of waiting players.
- Server-side shuffling, distinct icon card layouts, classic number columns, private cards, and concealed future draws.
- Confirmed manual stamps, catch-up marking, idempotent repeat clicks, incorrect-click feedback, automatic line detection, and shared round-end wins.
- Ghost Visit, Candy Rain, and Bubbling Cauldron events with no competitive effects.
- Reconnection and background recovery with the same card, confirmed marks, and original deadlines; no automatic marking or extra time.
- Late arrivals wait for the next game; games abort when all participants leave voluntarily; idle rooms expire; players can return to the lobby after results.
- Cosmetic candy rewards, three unlockable decorations, and separate solo best-round records for each mode.
- Dedicated portrait mobile and landscape desktop layouts, draw history, rate-limited emotes, and near-line hints.
- Remembered sound and reduced-motion settings, LittleJS ambient particles, event candy, and synthesized effects.

### Results and rewards

- A mark received at or after the deadline does not count toward the previous round. Requests include the game ID and round; they are not queued into a later round. Players must manually try again during a normal round.
- Disconnecting retains eligibility and confirmed marks. Leaving voluntarily forfeits eligibility and candy, including when a player qualified before leaving but the round has not ended.
- Multiplayer participation earns 10 candy after at least four distinct non-FREE stamps confirmed across at least two rounds. Winners receive an additional 20 candy each. Shared winners receive the same full reward.
- Solo practice awards two candy for the first successful challenge per day in the Asia/Shanghai time zone, shared across both modes. Failed and repeated challenges award no candy.
- A game aborted because everyone left voluntarily awards no candy. Disconnected players who have not left are evaluated using their confirmed records.
- Waiting rooms expire after ten minutes without room actions. Results remain available for ten minutes. State polling does not extend room lifetime.

Candy unlocks cosmetic avatars, borders, and victory effects. It does not grant marking assistance or change cards, future draws, or winning odds.

### Persistence and runtime limits

The server saves player identities, candy, decorations, rooms, and current games to `.data/state.json` using temporary-file replacement. The `.data/` directory is ignored by Git and is not served as static content. Keep it out of public repositories.

Refreshing, reconnecting, or restarting the process restores the original deadlines. Server downtime does not extend the game. Player credentials are stored in the current browser; clearing browser storage creates a new identity. This version uses one authoritative Node.js process and does not include cross-device accounts, public matchmaking, or production multi-process storage.

### Validation

```sh
npm run check
npm test
```

The 19 automated tests cover legal card generation, number column ranges, complete timelines, absence of automatic marking in both modes, catch-up round attribution, multiple lines from one stamp, shared wins, event and deadline boundaries, leaving and disconnection, privacy, room capacity, reward idempotency, and persistence recovery. HTTP integration tests use independent clients and a controlled test clock. The production server has no draw-editing or time-acceleration interface.

Browser checks covered both modes, catch-up marking, a 24-round game with no winner, refresh recovery, and layouts at 360×800 and 1440×900. Manual-interaction checks verified that draws do not stamp or highlight answers, one valid click stamps one space, incorrect clicks do not add stamps, and confirmed stamps survive refresh. On a 360×800 screen, the card, stamp feedback, and recent history fit in one screen. Public-internet and high-latency load testing have not been performed.

### Project layout

| Path | Purpose |
| --- | --- |
| `src/app.js` | Pages, room and game interactions, state synchronization |
| `src/rules.js` | Icon names, classic numbers, 12 lines, near-line hints |
| `src/effects.js` | LittleJS particles, event effects, synthesized sounds |
| `src/style.css` | Mobile and desktop layouts |
| `server/game.mjs` | Authoritative game state machine and round-end results |
| `server/app.mjs` | Identity, room APIs, rewards, persistence |
| `scripts/serve.mjs` | Server entry point |
| `tests/` | Rule and HTTP integration tests |
| `assets/` | Generated background, 24-icon atlas, art prompts |
| `vendor/littlejs/` | Bundled engine, types, and original license notices |
| `upstream/LittleJS/` | Local shallow clone with its own Git history; ignored by the outer repository and not included in this repository |

### Engine and artwork

The bundled engine is [LittleJS](https://github.com/KilledByAPixel/LittleJS) version 1.27.2, pinned to commit `cdcbef463d889d24dee37f481c2ea5f49bf7fcf5`. Engine files are unmodified, and their license notices are preserved in `vendor/littlejs/`.

Artwork was generated with imagegen following the two supplied visual references. See [`assets/README.md`](assets/README.md) for the atlas layout and [`assets/ART-PROMPTS.md`](assets/ART-PROMPTS.md) for the generation prompts. Runtime assets are included locally and do not depend on temporary files or external image hosting.

### License

This project is open source under the [MIT License](LICENSE). LittleJS is also MIT-licensed; its original copyright and license notices remain in [`vendor/littlejs/LICENSE`](vendor/littlejs/LICENSE) and [`vendor/littlejs/COPYRIGHT.txt`](vendor/littlejs/COPYRIGHT.txt).
