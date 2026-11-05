var e=Object.assign({"/raw-docs/cpp/compile-link.md":`# [Dynamic Library & Static Library](https://stackoverflow.com/questions/140061/when-to-use-dynamic-vs-static-libraries)\r
\r
# [Compile Link Load](https://tech.meituan.com/2015/01/22/linker.html)\r
`,"/raw-docs/docs/site-setup.md":`# About & Site Setup Guide\r
\r
## Instructions Before Reading\r
\r
> [!WARNING]\r
> **Network Notice:** Because static assets are hosted on GitHub, access from mainland China may be slow or restricted.\r
\r
- **404 Troubleshooting:** If a page or script returns a 404 error, try appending the file extension (e.g., [\`build_site.py\`](https://linx-zhang.github.io/scripts/build_site.py)).\r
- **Code Copying Tip:** When copying code blocks, select the first line and press \`Ctrl + Shift + End\` to quickly select to the end of the block.\r
\r
---\r
\r
## How This Site Was Built\r
\r
This personal knowledge base is hosted for free via GitHub Pages. Here is the general workflow:\r
\r
1. **GitHub Setup:** Register a GitHub account and configure public repositories (\`linx-zhang.github.io\` for main content, plus an optional asset repo for static files).\r
2. **Directory Structure:** Organize content folders by topics (e.g., \`python\`, \`golang\`, \`cpp\`) and manage static assets under \`static/\`.\r
3. **Automated Menu Generation:** Generate and update the file tree navigation in \`index.html\` using the custom build script:\r
   - [Live Documentation](https://linx-zhang.github.io/scripts/build_site)\r
   - [Python Source Code](https://linx-zhang.github.io/scripts/build_site.py)\r
\r
---\r
\r
## Markdown Syntax Playground\r
\r
### 1. Nested Blockquote & List\r
> - **License**: MIT\r
> - **About**: Personal technical notes and code snippets\r
> - **Categories**:\r
>   - Algorithms\r
>   - DevOps\r
>   - GUI & Scripts\r
\r
### 2. Ordered List\r
1. Initialize repository\r
2. Pre-generate markdown files\r
3. Build \`index.html\` catalog\r
\r
### 3. Media & Links\r
![Avatar](https://github.com/linx-zhang/static/blob/main/icon/logo.jpg?raw=true)\r
\r
- Return to [Home / README](../README.md)`,"/raw-docs/golang/LAN-share.md":`\r
# Local Area Net Share local-file Tool\r
\r
- [LAN_Share.zip (win-x86-64.exe)](https://github.com/linx-zhang/static/blob/main/tools/LAN_Share.zip)\r
- If you have a python environment, \`python -m http.server 59999\`\r
- [Effect-1](http://m.qpic.cn/psc?/V52HCgKy0b7Yhv1a5Lcc2Cuwq53oINm3/ruAMsa53pVQWN7FLK88i5p5G3odP31egXDVQ2Ti9gyMPUn3rQMmOWPMMeJC5WXSnXgps*0Cklsya*ETJKZMl6LbYiOrClWSG3fw1m9vbfFo!/b&bo=2wUgAwAAAAADB98!&rf=viewer_4), [Effect-2](http://m.qpic.cn/psc?/V52HCgKy0b7Yhv1a5Lcc2Cuwq53oINm3/ruAMsa53pVQWN7FLK88i5hVVw6aqHpkyY6ynhdUb5b4h5EbL6uCk.ugW61VZMphE8i*1Q3EDR8ZkRE6BrauNmmhEsPP987JAirUl6KEQ1Ec!/b&bo=vgECAgAAAAADB50!&rf=viewer_4)\r
\r
- Source code\r
\r
\`\`\`go\r
import (\r
	"flag"\r
	"fmt"\r
	"log"\r
	"net"\r
	"net/http"\r
	"os"\r
	"path/filepath"\r
	"strings"\r
	"time"\r
)\r
\r
func Server() {\r
	// Faker-Connection -> addr\r
	conn, err := net.Dial("udp", "8.8.8.8:53")\r
	if err != nil {\r
		log.Println(err)\r
		return\r
	}\r
	localAddr := conn.LocalAddr().(*net.UDPAddr).String()\r
	localAddr = strings.Split(localAddr, ":")[0]\r
	log.Printf("\\nLocal ip address: %s", localAddr)\r
	// Shared folder\r
	defaultSharePath, _ := filepath.Abs(filepath.Dir(os.Args[0]))\r
	fmt.Println("Default Share Path:", defaultSharePath)\r
\r
	var folder, port string\r
	type MsgVarDefault struct {\r
		msg          string\r
		strPtr       *string\r
		defaultValue string\r
	}\r
	var msgVarDefault = []*MsgVarDefault{\r
		{\`Setting share folder path(Press enter use default): \`, &folder, defaultSharePath},\r
		{\`Setting port: \`, &port, "59999"},\r
	}\r
	for _, obj := range msgVarDefault {\r
		fmt.Print(obj.msg)\r
		fmt.Scanln(obj.strPtr)\r
		if *obj.strPtr == "" {\r
			*obj.strPtr = obj.defaultValue\r
		}\r
	}\r
\r
	// Server start\r
	var (\r
		listen = flag.String("listen", ":"+port, "listen address")\r
		dir    = flag.String("dir", folder, "directory to serve")\r
	)\r
	log.Printf("share %s, listening on http://%s%s...", *dir, localAddr, *listen)\r
	err = http.ListenAndServe(*listen, http.FileServer(http.Dir(*dir)))\r
	log.Println(err)\r
	time.Sleep(time.Second * 300)\r
}\r
\r
func main() {\r
	Server()\r
}\r
\r
\`\`\``,"/raw-docs/golang/has-timestamp-safe-id.md":`\r
# Generate Has Timestamp Id\r
\r
- The timestamp can be restored by id\r
- Does not expose timestamp\r
- The probability of duplicate id generated per second is \`1 / (1<<rand_bit_num)\` \r
\r
\`\`\`go\r
import (\r
	"crypto/rand"\r
	"fmt"\r
	"math/big"\r
	"time"\r
)\r
\r
const (\r
	// Set any milliseconds timestamp \r
	time_const   = 1657009310393\r
	// Random number bits\r
	rand_bit_num = 23\r
)\r
\r
var bigMath big.Int\r
\r
func MakeId() *big.Int {\r
	randInt, _ := rand.Int(rand.Reader, big.NewInt(1<<rand_bit_num))\r
\r
	bigT := big.NewInt(time.Now().UnixMilli() - time_const)\r
\r
	return bigMath.Or(bigMath.Lsh(bigT, rand_bit_num), randInt)\r
}\r
\r
func main() {\r
	id := MakeId()\r
	fmt.Println("Database saved ID:", id)\r
\r
	// Reset id to timestamp\r
	rsh_id := bigMath.Rsh(id, rand_bit_num)\r
	fmt.Println(bigMath.Add(rsh_id, big.NewInt(time_const)))\r
\r
}\r
\`\`\`\r
`,"/raw-docs/js/finance_simulator.html":`<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>25岁起理财资产趋势模拟器</title>
  <!-- 使用主流且零插件依赖的 Apache ECharts -->
  <script src="https://cdn.jsdelivr.net/npm/echarts@5.5.0/dist/echarts.min.js"><\/script>
  <style>
    * { box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "PingFang SC", "Microsoft YaHei", sans-serif;
      margin: 0;
      padding: 24px;
      background: #f1f5f9;
      color: #1e293b;
    }
    .wrapper {
      max-width: 1300px;
      margin: 0 auto;
      display: grid;
      grid-template-columns: 360px 1fr;
      gap: 24px;
    }
    @media (max-width: 900px) {
      .wrapper { grid-template-columns: 1fr; }
    }
    .card {
      background: #ffffff;
      border-radius: 12px;
      padding: 24px;
      box-shadow: 0 4px 6px -1px rgba(0,0,0,0.06);
    }
    h2 {
      margin: 0 0 16px 0;
      font-size: 1.15rem;
      color: #0f172a;
      border-left: 4px solid #2563eb;
      padding-left: 10px;
    }
    .field { margin-bottom: 15px; }
    .field label {
      display: flex;
      justify-content: space-between;
      font-size: 0.85rem;
      font-weight: 600;
      color: #475569;
      margin-bottom: 6px;
    }
    .field span { color: #2563eb; font-weight: 700; }
    input[type=range] {
      width: 100%;
      height: 6px;
      background: #e2e8f0;
      border-radius: 4px;
      outline: none;
      accent-color: #2563eb;
      cursor: pointer;
    }
    .btn-reset {
      width: 100%;
      padding: 10px;
      background: #e2e8f0;
      color: #334155;
      border: none;
      border-radius: 6px;
      font-weight: 600;
      cursor: pointer;
      margin-top: 10px;
      transition: background 0.2s;
    }
    .btn-reset:hover { background: #cbd5e1; }
    .kpi-row {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 12px;
      margin-bottom: 20px;
    }
    .kpi-card {
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      padding: 12px;
      text-align: center;
    }
    .kpi-title { font-size: 0.75rem; color: #64748b; margin-bottom: 4px; }
    .kpi-val { font-size: 1.25rem; font-weight: 700; color: #0f172a; }
    /* 显式声明固定像素高度，彻底解决容器尺寸折叠问题 */
    #chartContainer {
      width: 100%;
      height: 520px;
    }
  </style>
</head>
<body>

<div class="wrapper">
  <!-- 控制面板 -->
  <div class="card">
    <h2>参数配置</h2>

    <div class="field">
      <label>月薪 (k): <span id="txt_income">10.0</span></label>
      <input type="range" id="income" min="5" max="35" step="0.5" value="10.0">
    </div>

    <div class="field">
      <label>每月必要生活 (k): <span id="txt_living">4.5</span></label>
      <input type="range" id="living" min="2" max="12" step="0.1" value="4.5">
    </div>

    <div class="field">
      <label>长期理财年化收益: <span id="txt_rate">6.0%</span></label>
      <input type="range" id="rate" min="0.01" max="0.12" step="0.005" value="0.06">
    </div>

    <hr style="border: 0; border-top: 1px dashed #e2e8f0; margin: 18px 0;">

    <div class="field">
      <label>买车年龄 (25 + N): <span id="txt_car_age">3.0</span></label>
      <input type="range" id="car_age" min="1" max="15" step="0.5" value="3.0">
    </div>

    <div class="field">
      <label>买车金额 (k, 0为不买): <span id="txt_car_amt">120</span></label>
      <input type="range" id="car_amt" min="0" max="300" step="5" value="120">
    </div>

    <div class="field">
      <label>买房首付年龄 (25 + N): <span id="txt_house_age">7.0</span></label>
      <input type="range" id="house_age" min="2" max="20" step="0.5" value="7.0">
    </div>

    <div class="field">
      <label>买房首付金额 (k, 0为不买): <span id="txt_house_amt">250</span></label>
      <input type="range" id="house_amt" min="0" max="800" step="10" value="250">
    </div>

    <button class="btn-reset" onclick="resetForm()">重置所有参数</button>
  </div>

  <!-- 图表区域 -->
  <div class="card">
    <h2>资产走势图 (25 ~ 55 岁)</h2>
    
    <div class="kpi-row">
      <div class="kpi-card">
        <div class="kpi-title">每月净结余</div>
        <div class="kpi-val" id="kpi_surplus">0.00 k</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-title">中期资金峰值</div>
        <div class="kpi-val" id="kpi_mid_peak">0.0 k</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-title">55岁退休总资产</div>
        <div class="kpi-val" id="kpi_total">0.0 k</div>
      </div>
    </div>

    <div id="chartContainer"></div>
  </div>
</div>

<script>
const rate_cash = 0.02;
const rate_mid = 0.035;
const emerg_target = 27.0;
const total_months = 30 * 12;

let myChart = null;

function runSimulation(income, living, rateLong, carOffset, carAmt, houseOffset, houseAmt) {
  const disc = living / 4.0;
  const surplus = Math.max(0.0, income - (living + disc));

  const baseEmerg = surplus * 0.20;
  const baseMid = surplus * 0.30;
  const baseLong = surplus * 0.50;

  const rCash = Math.pow(1 + rate_cash, 1 / 12) - 1;
  const rMid = Math.pow(1 + rate_mid, 1 / 12) - 1;
  const rLong = Math.pow(1 + rateLong, 1 / 12) - 1;

  let balEmerg = 0.0, balMid = 0.0, balLong = 0.0;
  let maxMid = 0.0;

  // 严格校验：金额大于 0 时才计算有效扣款月
  const carMonth = (carAmt > 0) ? Math.round(carOffset * 12) : -1;
  const houseMonth = (houseAmt > 0) ? Math.round(houseOffset * 12) : -1;

  const ages = [];
  const dsEmerg = [], dsMid = [], dsLong = [], dsTotal = [];
  const markPoints = [];

  for (let m = 0; m < total_months; m++) {
    const age = +(25.0 + m / 12.0).toFixed(2);

    let curAddEmerg = baseEmerg;
    let curAddLong = baseLong;

    if (balEmerg >= emerg_target) {
      curAddEmerg = 0.0;
      curAddLong += baseEmerg;
    }

    balEmerg = balEmerg * (1 + rCash) + curAddEmerg;
    balMid = balMid * (1 + rMid) + baseMid;
    balLong = balLong * (1 + rLong) + curAddLong;

    if (balMid > maxMid) maxMid = balMid;

    // 扣款事件
    const handleExpense = (amt, name) => {
      if (amt <= 0) return;
      let need = amt;

      const takeMid = Math.min(balMid, need);
      balMid -= takeMid; need -= takeMid;

      if (need > 0) {
        const takeEmerg = Math.min(balEmerg, need);
        balEmerg -= takeEmerg; need -= takeEmerg;
      }
      if (need > 0) {
        balLong -= need;
      }

      const currentTotal = +(balEmerg + balMid + balLong).toFixed(1);
      markPoints.push({
        name: name,
        coord: [age.toString(), currentTotal],
        value: \`\${name}\\n-\${amt}k\`,
        itemStyle: { color: '#ef4444' }
      });
    };

    if (m === carMonth) handleExpense(carAmt, '买车');
    if (m === houseMonth) handleExpense(houseAmt, '买房首付');

    const total = +(balEmerg + balMid + balLong).toFixed(1);

    ages.push(age.toString());
    dsEmerg.push(+balEmerg.toFixed(1));
    dsMid.push(+balMid.toFixed(1));
    dsLong.push(+balLong.toFixed(1));
    dsTotal.push(total);
  }

  return { ages, dsEmerg, dsMid, dsLong, dsTotal, surplus, maxMid, markPoints };
}

function update() {
  const income = parseFloat(document.getElementById('income').value);
  const living = parseFloat(document.getElementById('living').value);
  const rate = parseFloat(document.getElementById('rate').value);
  const carAge = parseFloat(document.getElementById('car_age').value);
  const carAmt = parseFloat(document.getElementById('car_amt').value);
  const houseAge = parseFloat(document.getElementById('house_age').value);
  const houseAmt = parseFloat(document.getElementById('house_amt').value);

  // 刷新文本
  document.getElementById('txt_income').innerText = income.toFixed(1);
  document.getElementById('txt_living').innerText = living.toFixed(1);
  document.getElementById('txt_rate').innerText = (rate * 100).toFixed(1) + '%';
  document.getElementById('txt_car_age').innerText = carAge.toFixed(1);
  document.getElementById('txt_car_amt').innerText = carAmt > 0 ? carAmt : '0 (不买车)';
  document.getElementById('txt_house_age').innerText = houseAge.toFixed(1);
  document.getElementById('txt_house_amt').innerText = houseAmt > 0 ? houseAmt : '0 (不买房)';

  const res = runSimulation(income, living, rate, carAge, carAmt, houseAge, houseAmt);

  // 刷新卡片数值
  document.getElementById('kpi_surplus').innerText = res.surplus.toFixed(2) + ' k';
  document.getElementById('kpi_mid_peak').innerText = res.maxMid.toFixed(1) + ' k';
  document.getElementById('kpi_total').innerText = res.dsTotal[res.dsTotal.length - 1] + ' k';

  const option = {
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'cross' },
      formatter: function(params) {
        let str = \`<b>年龄: \${params[0].axisValue} 岁</b><br/>\`;
        params.forEach(p => {
          str += \`\${p.marker} \${p.seriesName}: <b>\${p.value} k</b><br/>\`;
        });
        return str;
      }
    },
    legend: {
      data: ['应急金', '中期资金(车/房)', '长期理财', '总资产'],
      top: 0
    },
    grid: {
      left: '3%',
      right: '4%',
      bottom: '5%',
      top: '40px',
      containLabel: true
    },
    xAxis: {
      type: 'category',
      boundaryGap: false,
      data: res.ages,
      name: '年龄 (岁)',
      axisLabel: {
        interval: 23 // 约每2年显示一个刻度标签
      }
    },
    yAxis: {
      type: 'value',
      name: '金额 (k 元)',
      splitLine: { lineStyle: { type: 'dashed', color: '#e2e8f0' } }
    },
    series: [
      {
        name: '应急金',
        type: 'line',
        showSymbol: false,
        data: res.dsEmerg,
        itemStyle: { color: '#10b981' },
        lineStyle: { width: 2 }
      },
      {
        name: '中期资金(车/房)',
        type: 'line',
        showSymbol: false,
        data: res.dsMid,
        itemStyle: { color: '#f59e0b' },
        lineStyle: { width: 2 }
      },
      {
        name: '长期理财',
        type: 'line',
        showSymbol: false,
        data: res.dsLong,
        itemStyle: { color: '#3b82f6' },
        lineStyle: { width: 2 }
      },
      {
        name: '总资产',
        type: 'line',
        showSymbol: false,
        data: res.dsTotal,
        itemStyle: { color: '#0f172a' },
        lineStyle: { width: 2.5, type: 'dashed' },
        markPoint: {
          symbol: 'pin',
          symbolSize: 55,
          label: {
            fontSize: 10,
            lineHeight: 12
          },
          data: res.markPoints
        }
      }
    ]
  };

  myChart.setOption(option, true);
}

function resetForm() {
  document.getElementById('income').value = 10.0;
  document.getElementById('living').value = 4.5;
  document.getElementById('rate').value = 0.06;
  document.getElementById('car_age').value = 3.0;
  document.getElementById('car_amt').value = 120;
  document.getElementById('house_age').value = 7.0;
  document.getElementById('house_amt').value = 250;
  update();
}

window.addEventListener('DOMContentLoaded', () => {
  const dom = document.getElementById('chartContainer');
  myChart = echarts.init(dom);
  window.addEventListener('resize', () => myChart.resize());

  document.querySelectorAll('input[type=range]').forEach(el => {
    el.addEventListener('input', update);
  });

  update();
});
<\/script>
</body>
</html>`,"/raw-docs/python/algorithm/get-tree-bottom.md":`\r
# Get the keys of all levels above the base type\r
\r
\`\`\`python\r
\r
data = {\r
    "k1": {"k1": {"k1": 1, "k2": 2}},\r
    "k2": {"k1": {"k1": 3, "k2": {"k1": 4, "k2": 5}}},\r
    "k3": {"k1": {"k1": {"k1": 6, "k2": 7}}},\r
    "k4": {"k1": 8, "k2": 9},\r
}\r
\r
flat_res = {}\r
has_data_keys = set()\r
\r
\r
def flat_dict(dictionary, keys=None):\r
    for k, v in dictionary.items():\r
        local_k = (keys[:] + [k]) if keys is not None else [k]\r
        if isinstance(v, dict):\r
            flat_dict(v, local_k)\r
        else:\r
            flat_res[tuple(local_k)] = v\r
            has_data_keys.add(tuple(keys))\r
\r
\r
flat_dict(data)\r
\r
\`\`\`\r
\r
## TestCase & Output\r
\r
\`\`\`python\r
\r
from pprint import pprint\r
\r
pprint(flat_res)\r
# Out\r
"""\r
{\r
('k1', 'k1', 'k1'): 1,\r
('k1', 'k1', 'k2'): 2,\r
('k2', 'k1', 'k1'): 3,\r
('k2', 'k1', 'k2', 'k1'): 4,\r
('k2', 'k1', 'k2', 'k2'): 5,\r
('k3', 'k1', 'k1', 'k1'): 6,\r
('k3', 'k1', 'k1', 'k2'): 7,\r
('k4', 'k1'): 8,\r
('k4', 'k2'): 9\r
}\r
"""\r
\r
pprint(has_data_keys)\r
# Out\r
"""\r
{('k2', 'k1', 'k2'), ('k4',), ('k1', 'k1'), ('k2', 'k1'), ('k3', 'k1', 'k1')}\r
"""\r
\r
\r
# k1, k3 Single Key\r
def f(top_k):\r
    pprint({"--".join(k): v for k, v in flat_res.items() if k[0] == top_k})\r
\r
\r
f("k1")\r
# Out\r
"""\r
{'k1--k1--k1': 1, 'k1--k1--k2': 2}\r
"""\r
\r
f("k3")\r
# Out\r
"""\r
{'k3--k1--k1--k1': 6, 'k3--k1--k1--k2': 7}\r
"""\r
\r
f("k2")\r
# Out\r
"""\r
{'k2--k1--k1': 3, 'k2--k1--k2--k1': 4, 'k2--k1--k2--k2': 5}\r
"""\r
\r
f("k4")\r
# Out\r
"""\r
{'k4--k1': 8, 'k4--k2': 9}\r
"""\r
\r
\`\`\``,"/raw-docs/python/concat_images.md":`\r
\`\`\`python\r
import os\r
from PIL import Image\r
\r
def merge_images_vertical(target_dir: str, output_path: str = "merged.png"):\r
    """\r
    多张图片从上到下合并，左对齐，宽度不够补白色背景\r
    :param target_dir: 图片文件夹路径\r
    :param output_path: 输出图片路径\r
    """\r
    # 1. 获取文件夹图片，按文件名排序\r
    img_ext = (".jpg", ".jpeg", ".png", ".bmp")\r
    file_list = [f for f in os.listdir(target_dir) if f.lower().endswith(img_ext)]\r
    file_list.sort()  # 按文件名排序\r
\r
    if not file_list:\r
        raise FileNotFoundError("target文件夹没有找到图片")\r
\r
    images = []\r
    max_width = 0\r
    total_height = 0\r
\r
    # 遍历读取图片，计算最大宽度、总高度\r
    for filename in file_list:\r
        fp = os.path.join(target_dir, filename)\r
        im = Image.open(fp).convert("RGBA")\r
        images.append(im)\r
        w, h = im.size\r
        if w > max_width:\r
            max_width = w\r
        total_height += h\r
\r
    # 创建画布：最大宽度，全部图片高度之和，白色背景\r
    result = Image.new("RGBA", (max_width, total_height), color=(255, 255, 255, 255))\r
\r
    current_y = 0\r
    for im in images:\r
        w, h = im.size\r
        # 左对齐粘贴，x=0；宽度不足max_width，右侧自动留白\r
        result.paste(im, box=(0, current_y))\r
        current_y += h\r
\r
    # 如果想要输出jpg，转RGB去掉alpha通道\r
    if output_path.lower().endswith(".jpg") or output_path.lower().endswith(".jpeg"):\r
        result = result.convert("RGB")\r
    result.save(output_path)\r
    print(f"合并完成，输出：{output_path}")\r
\r
\r
if __name__ == "__main__":\r
    merge_images_vertical(target_dir="./target", output_path="./out.png")\r
\r
\`\`\`\r
`,"/raw-docs/python/concat_multiple_img.md":`\`\`\`python\r
import os\r
import time\r
from PIL import Image\r
import numpy as np\r
\r
t = time.time()\r
\r
# 设置图片路径\r
image_dir = r'C:\\Users\\Linx\\Pictures\\Screenshots'\r
\r
# 获取目录下的所有图片文件\r
image_files = [f for f in os.listdir(image_dir) if f.endswith('.jpg') or f.endswith('.png')]\r
\r
# 将每个图片转换为 NumPy 数组并存储在列表中\r
image_arrays = []\r
for image_file in sorted(image_files):\r
    image = Image.open(os.path.join(image_dir, image_file))\r
    image_array = np.array(image)\r
    image_arrays.append(image_array)\r
\r
# 获取最大的宽度，填充白色\r
max_width = max(image_array.shape[1] for image_array in image_arrays)\r
pixel_len = max(image_array.shape[2] for image_array in image_arrays)\r
for i, image_array in enumerate(image_arrays):\r
    # 宽度统一\r
    if image_array.shape[1] < max_width:\r
        # TODO color\r
        color = [255, 255, 255]\r
        if image_array.shape[2] == 4:\r
            color.append(255)\r
        length = image_array.shape[0]\r
        width = max_width - image_array.shape[1]\r
\r
        padding = np.array([color] * length * width, dtype=np.uint8).reshape(\r
            (length, width, len(color))\r
        )\r
        image_array = np.concatenate((image_array, padding), axis=1)\r
\r
    # 补充rgb -> rgba\r
    if image_array.shape[2] < pixel_len:\r
        image_array = np.pad(image_array,\r
                             ((0, 0), (0, 0), (0, pixel_len - image_array.shape[2])),\r
                             'constant', constant_values=255)\r
    image_arrays[i] = image_array\r
\r
# 纵向合并所有 NumPy 数组\r
merged_array = np.concatenate(image_arrays, axis=0)\r
\r
# 从合并后的 NumPy 数组创建 PIL 图像\r
merged_image = Image.fromarray(merged_array)\r
\r
# 保存长图\r
merged_image.save(image_dir + r'\\long_image.png')\r
\r
print('Time:', time.time() - t)\r
print('Done!')\r
\r
\`\`\`\r
`,"/raw-docs/python/cprofile-example.md":`\`\`\`python\r
import cProfile\r
import pstats\r
import io\r
from django.conf import settings\r
from django.http import HttpResponse\r
\r
\r
class ProfileMiddleware:\r
    def __init__(self, get_response):\r
        self.get_response = get_response\r
\r
    def __call__(self, request):\r
        # 只对特定视图启用性能分析\r
        if 'myalva/analysis' in request.path:\r
            pr = cProfile.Profile()\r
            pr.enable()\r
\r
            response = self.get_response(request)\r
\r
            pr.disable()\r
            s = io.StringIO()\r
            sortby = pstats.SortKey.CUMULATIVE\r
            ps = pstats.Stats(pr, stream=s).sort_stats(sortby)\r
            ps.print_stats()\r
\r
            # 将统计信息写入响应或记录到文件\r
            print(s.getvalue())  # 或者写入日志文件\r
\r
            return response\r
        else:\r
            return self.get_response(request)\r
\`\`\``,"/raw-docs/python/devops/devops-overview.md":`\r
# What's Devops\r
\r
If you look back to the state of technology only a few decades ago, you’ll stumble upon a technological world full of silos and frustration. Two of an organization’s most vital teams—software development and IT operations—struggled to communicate effectively. Departments resided within silos, and development and testing were conducted at a snail’s pace.\r
\r
I still have flashbacks of a time when dev teams would build a package, throw it over the wall, and just wait for QA to provide feedback. There was absolutely no communication during development—only when the dev team considered the project “done.” Even companies deploying once a month ran into production issues.\r
\r
Though this waterfall-based approach was inherently more conservative on paper, internal clashes made things remarkably difficult. Companies clearly needed to rethink their approaches. Long-standing development processes were leading to botched launches and rollbacks. Stakeholder priorities conflicted mightily with those of technical teams. Chains of productivity were fundamentally broken. Massive, monolithic source code hanges were growing cumbersome, and even iterative changes induced headaches.\r
\r
However, with the introduction of microservices—a groundbreaking new infrastructure model comprised of small code blocks and APIs built atop scalable cloud-computing deployments—Agile software development and lean methodologies became integral to maintaining these new deployments. After all, the codebases were shrinking, teams came to own their own features, and months-long testing was no longer necessary to guarantee core functionality.\r
\r
**And DevOps was born**—ushering in elevated cohesiveness, efficiency, and a cultural renaissance across all business units.\r
\r
In this guide, I’ll explain the ins and outs of DevOps, key best practices, and the criticality of cultural change in organizations to integrate DevOps methodologies and support better development practices, automated processes, and—ultimately—a better product.\r
\r
## How Does DevOps Work? DevOps Methodology Explained\r
\r
Development and operations form the crux of DevOps. These two units form a tight-knit collaborative bond, and any software-related processes are equally designed around both teams. Additionally, effective implementation of DevOps is dependent on establishing an efficient pipeline. This cyclical collection of stages covers everything from planning to release and the capabilities needed within the delivery process:\r
\r
\r
<a target="_blank" href="http://m.qpic.cn/psc?/V52HCgKy0b7Yhv1a5Lcc2Cuwq53oINm3/ruAMsa53pVQWN7FLK88i5ig53.Smmj47X.o94KnbpZoFIMvN2QLop0IkfrG9BppnmicAPv3.5ThdT1hl8Q2bLKdPmt8vdvAvbXsj9CGSgEk!/b&bo=AARtAgAAAAADB0k!&rf=viewer_4">\r
<img title="Click If No Picture" src="https://github.com/linx-zhang/static/blob/main/python/DevOps-lifecycle-capabilities-1024x621.png?raw=true">\r
</a>\r
\r
\r
Though “deliberate” development pacing was once commonplace, DevOps instead centers on agility. By tightly integrating the roles of engineers, testers, and administrators, companies can achieve new heights of productivity. The feedback loop is enormously integral to realizing these DevOps benefits.\r
\r
In a simple example, a developer will code a program and ship it off to testers for evaluation. Testers make notes and send feedback back to the engineers, who refine the product prior to deployment. This isn’t reserved just for beta periods prior to launch, since DevOps is a continual process spanning the entire software life cycle. Additionally, observing how this code (input) behaves when running in a test environment (output) tells developers and designers plenty about software readiness.\r
\r
Additionally, DevOps was created to lower update failure rates, shorten recovery or remediation times, and promote faster releases. We’re naturally conditioned to link higher failure rates with increased release agility, but the pipeline helps boost reliability by wide margins.\r
\r
The DevOps Research and Assessment (DORA) group evaluates how successfully organizations implement these processes. Companies are either designated as low, medium, high, or elite performers. As expected, low performers release exceptionally infrequently, take a long time to fix issues, and experience failures more often. The opposite is true for elite performers—the best of the best, including household names like Google, PayPal, and Netflix. These companies have embraced DevOps completely and may deploy over 100 times daily.\r
\r
## What Does a DevOps Role Do?\r
\r
Each company generally implements its own unique flavor of DevOps, which can also take the form of other job titles. After all, DevOps engineers can oversee different products, use different tech stacks, and have varied job responsibilities depending on where the organization is in its digital transformation journey and whether cross-departmental collaboration between operations and other teams is crucial to business agility.\r
\r
For example, DevSecOps is the intersection of DevOps and security and focuses on managing security throughout the feedback loop, which includes identifying, resolving, and managing bugs, vulnerabilities, and other security risks. A site reliability engineer (SRE) is another role borrowing many DevOps methodologies, such as automating what can be automated, reducing tedious “busy work,” and freeing up time to focus on other tasks.\r
\r
## DevOps Best Practices\r
\r
Regardless of job title, there are common DevOps principles applicable to many different types of roles and workplaces, including the synonymous principles of continuous integration and continuous delivery or deployment (CI/CD) and the shift-left philosophy of CI/CD encouraging frequent testing as early as possible.\r
\r
Traditionally, implementing strong CI/CD supported by adopting several purpose-built DevOps tools is how organizations try to optimize the full scope of development performance. However, implementing piecemeal solutions to address specific use cases and requirements—such as having a service management tool to react to incidents, a separate tool to monitor infrastructure performance, and another solution for managing assets—can lead to toolset creep, operational blind spots, and disjointed data.\r
\r
To keep up with the demands and complexities of modern environments, operational-focused teams like DevOps are shifting to using full-stack observability solutions. Observability combines network, cloud, system, application, services, and database metrics into a single source of truth. Observability supports the ability to delve more easily deeper into performance analytics, identify greater workflow efficiencies and automation opportunities across organizations, and streamline the closed-loop management every DevOps practitioner holds near and dear.\r
\r
Also, gather as much feedback as you can. Be sure to check in with your teams to ensure smooth progress on projects and builds.\r
\r
This comes with a caveat, however. I recommend being wary of hanging on to feedback without moving through the feedback loop. I’ve seen where getting bogged down can become counterproductive. Taking proactive and reactive steps to fix problems is essential, and you can do so by understanding how to interpret and relay findings.\r
\r
Last but certainly not least, remain mindful of your organizational goals. Perhaps you’ve aced observability but your early development pipeline is undeveloped. Know your strengths and weaknesses and strategize accordingly.\r
\r
## The Importance of Adopting a DevOps Culture\r
\r
Though DevOps is a technical methodology, it’s also an inherently human approach. DevOps embraces agility and problem-solving. Collaboration is central. Having a DevOps mindset encourages broader communication instead of sticking strictly to one discipline.\r
\r
This is antithetical to many organizations—especially traditional ones. Getting on board with DevOps might require a cultural shift or even a reorganization. Accordingly, there must be a focus on shedding blame for any failures. By focusing on the problem, you can prevent failures from recurring without alienating team members. Remember, each link in the chain is important.\r
\r
If there's one thing I've gathered from those intimately familiar with DevOps, it's development teams and operations teams must dive in headfirst to enjoy success. Though company culture doesn’t shift radically overnight, organizations can adjust their existing processes to implement these core DevOps best practices into everyday workflows. It's impossible to halfheartedly adopt these practices and gain the full scope of DevOps benefits in return. So, don't adopt DevOps because it's trendy; do it because the data for how DevOps can improve your development workflow shows clear benefits.\r
\r
While improving workflows is key to building stronger development processes, making sure you have the right insights across your IT infrastructure can be just as crucial. SolarWinds® Observability is designed to provide the centralized, comprehensive performance monitoring data and insights DevOps, ITOps, and security teams need to act quickly and more efficiently.\r
\r
---\r
\r
[For more people to see, copy and paste.](https://orangematter.solarwinds.com/2022/03/21/what-is-devops/)\r
\r
**If there is a copyright issue, please contact me to delete.**`,"/raw-docs/python/find-cn-char.md":`\r
# Find chinese-character Tool\r
\r
- [Find-chinese-character.zip (win-x86-64.exe)](https://github.com/linx-zhang/static/blob/main/tools/find_cn_character.zip)\r
- Source code execution, Requires a python environment\r
- \`Find.open_file_check.zh_pattern\` can be customized\r
- [output\`zh.json\`](http://m.qpic.cn/psc?/V52HCgKy0b7Yhv1a5Lcc2Cuwq53oINm3/ruAMsa53pVQWN7FLK88i5sQRKXyjssey5bD0sGgNn76ogLYakfOhyO2XOx4OqsgDnr4xYowKZhPpWgic3vp7t5cuLM3uktjk2DagtcUwP*A!/b&bo=GgSdAgAAAAADB6M!&rf=viewer_4)\r
\r
\`\`\`python\r
\r
import os\r
import sys\r
import re\r
import json\r
import time\r
from collections import defaultdict\r
from functools import lru_cache\r
\r
sys.path.append(os.path.abspath(__file__))\r
\r
\r
SCAN_DIR = r"D:\\this_code\\test\\我的笔记\\linx-zhang.github.io"\r
# SCAN_DIR = input('Input Scan Folder, please:')\r
RESULTS_FILE = os.path.join(SCAN_DIR, "zh.json")\r
PASS_DIRS = [\r
    ".git",\r
    ".vscode",\r
    ".idea",\r
    # "scripts",\r
]\r
\r
\r
class Find:\r
    def __init__(self) -> None:\r
        self.init()\r
\r
        results_dict = defaultdict(list)\r
        for root, dirs, files in os.walk(SCAN_DIR):\r
            if root in self.pass_dirs():\r
                continue\r
            for f in files:\r
                try:\r
                    self.open_file_check(os.path.join(root, f), results_dict)\r
                except Exception:  # noqa\r
                    continue\r
        with open(RESULTS_FILE, "w") as fw:\r
            fw.write(json.dumps(results_dict, indent=2))\r
\r
    def init(self):\r
\r
        global SCAN_DIR\r
        global RESULTS_FILE\r
        global PASS_DIRS\r
\r
        SCAN_DIR = input("Input Scan Folder, please:")\r
        RESULTS_FILE = os.path.join(SCAN_DIR, "zh.json")\r
\r
    @staticmethod\r
    def open_file_check(\r
        file: str, results: defaultdict, zh_pattern=re.compile("[\\u4e00-\\u9fa5]+")\r
    ):\r
        with open(file, "r", encoding="utf8") as fr:\r
            for index, line in enumerate(iter(fr.readline, "")):\r
                if zh_pattern.search(line):\r
                    results[file[len(SCAN_DIR) :]].append(index + 1)\r
\r
    @staticmethod\r
    @lru_cache()\r
    def pass_dirs():\r
        dir_set = set()\r
\r
        for dir_item in PASS_DIRS:\r
            root_dir = os.path.join(SCAN_DIR, *filter(None, dir_item.split("/")))\r
            dir_set.add(root_dir)\r
            dir_set |= {\r
                os.path.join(r, d) for r, dir_s, _ in os.walk(root_dir) for d in dir_s\r
            }\r
        return dir_set\r
\r
\r
if __name__ == "__main__":\r
    t = time.time()\r
\r
    while True:\r
        try:\r
            Find()\r
        except Exception as e:\r
            print(e)\r
        else:\r
            break\r
\r
    print("Took", time.time() - t, "seconds")\r
    print("Results file:", RESULTS_FILE)\r
    input()\r
\r
\`\`\``,"/raw-docs/python/get-memory-size.md":`\r
# Get Memory Sizeof | Python\r
\r
- Pympler\r
  - [Pympler pypi](https://pypi.org/project/Pympler/#description)\r
  - e.g.\r
\r
  \`\`\`python\r
  from pympler import asizeof\r
  a = GenMenu()\r
  a.overwrite()\r
  print(asizeof.asizeof(a))\r
  # Out: 29352\r
  \`\`\`\r
\r
- objsize\r
  - [objsize pypi](https://pypi.org/project/objsize/#description)\r
  - e.g.\r
\r
  \`\`\`python\r
  from objsize import get_deep_size\r
  a = GenMenu()\r
  a.overwrite()\r
  print(get_deep_size(a))\r
  # Out: 28990\r
  \`\`\`\r
\r
\r
- Use sys.getsizeof() if you DON'T want to include sizes of linked (nested) objects:\r
\r
\`\`\`python\r
import sys\r
sys.getsizeof([1,2,3])\r
# Out: 120\r
\`\`\`\r
\r
- However, if you want to count sub-objects nested in lists, dicts, sets, tuples - and usually THIS is what you're looking for - use the recursive deep sizeof() function as shown below:\r
\r
\`\`\`python\r
import sys\r
def sizeof(obj):\r
    size = sys.getsizeof(obj)\r
    if isinstance(obj, dict): return size + sum(map(sizeof, obj.keys())) + sum(map(sizeof, obj.values()))\r
    if isinstance(obj, (list, tuple, set, frozenset)): return size + sum(map(sizeof, obj))\r
    return size\r
\`\`\``,"/raw-docs/python/import.md":`\r
# importlib\r
\r
- Import python files anywhere\r
\r
\`\`\`python\r
\r
import importlib.util\r
\r
\r
def get_module(py_path):\r
    spec = importlib.util.spec_from_file_location(\r
        name="give_me_module_name",\r
        location=py_path,\r
    )\r
    module = importlib.util.module_from_spec(spec)\r
    spec.loader.exec_module(module)\r
    return module\r
\r
\r
path = r"F:\\project\\py_test\\linx-zhang.github.io\\scripts\\generate_menu.py"\r
menu_module = get_module(path)\r
\r
path = r"F:\\project\\py_test\\linx-zhang.github.io\\python\\algorithm\\get-tree-bottom.py"\r
tree_module = get_module(path)\r
\r
\`\`\``,"/raw-docs/python/io-cpu-intensive-task.md":`\r
# 提要\r
\r
- 在python中，经常会提到io密集型任务可以用多线程提速，cpu密集型可以用多进程提速\r
- io密集型任务、cpu密集型任务有哪些\r
- 多线程一定能提速io密集型任务吗\r
- python多线程、多进程、协程是为了解决什么\r
\r
\r
# 起源\r
\r
q：多线程读取本地硬盘多个文件，是否能加速？  \r
\r
a：不能，磁盘读取速度瓶颈，多线程和同步代码读文件速度一样，甚至多线程会增加cpu 2ms一次的线程切换资源消耗  \r
\r
q：多线程读文件的同时，有写入远程数据库的操作，加速？  \r
\r
a：可以，写入数据库有io等待，数据库可以并行写入，直到数据库写入速度上限  \r
\r
**多线程是否能加速，取决于和程序交互的对象工作方式和性能**\r
\r
\r
## io密集型任务\r
\r
- 从硬盘驱动器读取或写入文件\r
- 读取或写入标准输出、输入或错误（stdin、stdout、stderr）\r
- 打印文档\r
- 下载或上传文件\r
- 查询服务器\r
- 查询数据库\r
- 拍照或录制视频\r
- ...\r
\r
\r
## cpu密集型任务\r
\r
- 计算分形中的点\r
- 估计 Pi\r
- 因式分解素数\r
- 解析 HTML、JSON 等文档\r
- 处理文本\r
- 运行模拟\r
- ...\r
\r
\r
## python多线程、多进程、协程是为了解决什么问题\r
\r
- 多线程和协程为了 io等待时，当前进程线程的cpu 内存等硬件资源处理其他任务\r
- 多进程为了多核cpu 并行执行某些计算任务\r
\r
### 协程\r
\r
- 底层利用os epoll(select poll epoll)，yield\r
- await只能修饰async function\r
- async关键字是为了让python asyncio 以事件循环的方式执行代码，否则默认同步执行代码\r
- 没有await的async对象宏观上无异于同步代码\r
\r
\r
**[io-cpu密集型任务来源](https://superfastpython.com/thread-vs-process/#When_to_Use_Threads)**\r
`,"/raw-docs/python/pyqt/guide.html":`\r
<head>\r
    <link rel="stylesheet" href="https://linx-zhang.github.io/static/css/github-markdown.css">\r
\r
<title></title>\r
</head>\r
\r
<body>\r
<article class="markdown-body">\r
\r
<ul>\r
    <li>下载qt</li>\r
    <ol>\r
        <li>asd</li>\r
        <li>assd</li>\r
    </ol>\r
    <li>visual studio</li>\r
    <li>cmake</li>\r
    <li>NSIS</li>\r
    <li>nsi</li>\r
\r
</ul>\r
\r
</article>\r
</body>\r
`,"/raw-docs/python/sign.md":`\`\`\`python\r
import hashlib\r
import json\r
import time\r
\r
\r
class Db:\r
    key = "key-jdiqwojaf"\r
    secret = "secret-pskdfhsjfhsfhjk"\r
    key_secret = {key: secret}\r
\r
    last_sign = ""\r
\r
    @classmethod\r
    def get(cls, k):\r
        return cls.secret\r
\r
\r
def h256(data: str):\r
    b_data = data.encode(encoding="utf-8")\r
    hash_object = hashlib.sha256()\r
    hash_object.update(b_data)\r
    hash_value = hash_object.hexdigest()\r
\r
    print("SHA-256 Hash Value:", hash_value)\r
    return hash_value\r
\r
\r
def sender(data: dict):\r
    data.update(\r
        key=Db.key,\r
        timestamp=int(time.time() * 1000),\r
    )\r
    sorted_data = {k: data[k] for k in sorted(data)}\r
    hash_str = json.dumps(sorted_data) + Db.secret\r
    return {\r
        **sorted_data,\r
        "sign": h256(hash_str),\r
    }\r
\r
\r
def receiver(data: dict):\r
    sign = data.pop("sign", None)\r
    timestamp = data.get("timestamp")\r
    # key enable\r
    secret = Db.get(data.get("key"))\r
\r
    if time.time() * 1000 - timestamp > 5000:\r
        raise TimeoutError("sign timeout 5s")\r
    sorted_data = {k: data[k] for k in sorted(data)}\r
    hash_str = json.dumps(sorted_data) + secret\r
    if sign != h256(hash_str):\r
        raise ValueError("sign err")\r
\r
\r
d = {}\r
\r
receiver(sender(d))\r
\r
\`\`\`\r
`,"/raw-docs/scripts/build_site.md":`\`\`\`python\r
import os\r
import re\r
import shutil\r
import subprocess\r
from pathlib import Path\r
from typing import Dict, Iterable, List, Optional, Set\r
\r
\r
def find_repository_root(target_name: str = "linx-zhang.github.io") -> Path:\r
    """递归向上或当前目录搜索指定的仓库根目录，未找到则回退到上一级目录。"""\r
    current_dir = Path.cwd().resolve()\r
    for root, dirs, _ in os.walk(current_dir):\r
        if target_name in dirs:\r
            return Path(root) / target_name\r
    return current_dir.parent\r
\r
\r
PROJECT_ROOT: Path = find_repository_root()\r
\r
\r
class ReactAboutBuilder:\r
    """\r
    编译 about-me-src 的React项目，npm run build，然后把dist覆盖到 about-me\r
    目录约定：\r
        PROJECT_ROOT / "about-me-src"  # vite源码目录\r
        PROJECT_ROOT / "about-me"      # 对外静态产物目录\r
    """\r
\r
    SRC_DIR = PROJECT_ROOT / "about-me-src"\r
    DIST_DIR = SRC_DIR / "dist"\r
    TARGET_DIR = PROJECT_ROOT / "about-me"\r
\r
    def build_and_sync(self):\r
        if not self.SRC_DIR.exists():\r
            print(f"[React] skip, source dir not found: {self.SRC_DIR}")\r
            return\r
\r
        print(f"[React] Enter {self.SRC_DIR}, run npm run build ...")\r
        ret = subprocess.run(\r
            ["npm", "run", "build"], cwd=self.SRC_DIR, capture_output=False, shell=True\r
        )\r
        if ret.returncode != 0:\r
            raise RuntimeError("[React] npm run build failed")\r
\r
        if not self.DIST_DIR.exists():\r
            raise RuntimeError("[React] dist folder not generated after build")\r
\r
        # 先清空目标目录，防止残留旧assets、旧html\r
        if self.TARGET_DIR.exists():\r
            shutil.rmtree(self.TARGET_DIR)\r
        self.TARGET_DIR.mkdir(exist_ok=True)\r
\r
        for item in self.DIST_DIR.iterdir():\r
            dest = self.TARGET_DIR / item.name\r
            shutil.move(item, dest)\r
\r
        print(f"[React] Sync dist -> {self.TARGET_DIR} success!")\r
\r
\r
class SiteIndexBuilder:\r
    """扫描项目结构并生成/更新 index.html 中的站点导航目录列表。"""\r
\r
    GITHUB_BASE_URL: str = "https://linx-zhang.github.io/"\r
    FOLDER_ICON: str = '<img src="./static/icon/folder.png" >'\r
    FILE_ICON: str = '<img src="./static/icon/file_icon.png" >'\r
\r
    IGNORE_DIR_NAMES: Set[str] = {\r
        ".git",\r
        ".idea",\r
        "__pycache__",\r
        "dist",\r
        "node_modules",\r
        "static",\r
        "about-me",\r
        "about-me-src",\r
    }\r
    EXCLUDED_FILE_SUFFIXES: Set[str] = {".go", ".py"}\r
\r
    DIRECTORY_INDENT: str = "&nbsp;" * 8\r
    LINE_INDENT: str = " " * 4\r
    UL_REGEX: re.Pattern = re.compile(r"<ul>(.*?)</ul>", re.DOTALL)\r
\r
    def __init__(self, root_dir: Path = PROJECT_ROOT) -> None:\r
        self.root_dir = root_dir\r
        self.index_file = self.root_dir / "index.html"\r
        self.visited_prefixes: Set[str] = set()\r
        self.html_entries: List[str] = ["\\n"]\r
\r
    def build_and_overwrite(self) -> None:\r
        """执行目录遍历并覆写 index.html。"""\r
        self._traverse_directory()\r
        if not self.index_file.exists():\r
            print(f"[Warning] Index file not found at: {self.index_file}")\r
            return\r
\r
        index_content = self.index_file.read_text(encoding="utf-8")\r
        match = self.UL_REGEX.search(index_content)\r
        if not match:\r
            print("[Warning] No <ul>...</ul> tags found in index.html to replace.")\r
            return\r
\r
        old_ul_content = match.group(1)\r
        new_ul_content = self.LINE_INDENT.join(self.html_entries)\r
        updated_content = index_content.replace(old_ul_content, new_ul_content, 1)\r
\r
        self.index_file.write_text(updated_content, encoding="utf-8")\r
        print(f"[Success] Updated navigation in {self.index_file}")\r
\r
    def _traverse_directory(self) -> None:\r
        for current_root, dir_names, file_names in os.walk(self.root_dir):\r
            # 原地过滤无需扫描的目录，提升遍历性能\r
            dir_names[:] = [d for d in dir_names if d not in self.IGNORE_DIR_NAMES]\r
\r
            if not file_names:\r
                continue\r
\r
            for file_name in file_names:\r
                file_path = Path(current_root) / file_name\r
                if file_path.suffix in self.EXCLUDED_FILE_SUFFIXES:\r
                    continue\r
\r
                rel_path = file_path.relative_to(self.root_dir)\r
                self._record_path_entry(rel_path)\r
\r
    def _record_path_entry(self, rel_path: Path) -> None:\r
        parts = rel_path.parts\r
        if len(parts) <= 1:\r
            return\r
\r
        for depth, part in enumerate(parts, start=1):\r
            sub_path = "/".join(parts[:depth])\r
            if sub_path in self.visited_prefixes:\r
                continue\r
            self.visited_prefixes.add(sub_path)\r
\r
            indent = self.DIRECTORY_INDENT * (depth - 1)\r
            is_file = depth == len(parts)\r
\r
            if is_file:\r
                # 链接去除末尾后缀\r
                href_path = "/".join(parts)\r
                href = f"{self.GITHUB_BASE_URL}{href_path.rsplit('.', 1)[0]}"\r
                html = f'<li><a href="{href}">{indent}{self.FILE_ICON}{part}</a></li>'\r
            else:\r
                html = f"<li>{indent}{self.FOLDER_ICON}{part}</li>"\r
\r
            self.html_entries.append(f"{html}\\n")\r
\r
\r
class ScriptMarkdownExporter:\r
    """智能转换脚本文件为带有语法高亮代码块的 Markdown 文件。"""\r
\r
    # 扩展名到 Markdown 语法高亮标签映射\r
    LANGUAGE_MAP: Dict[str, str] = {\r
        ".py": "python",\r
        ".go": "go",\r
        ".sh": "bash",\r
        ".bash": "bash",\r
        ".js": "javascript",\r
        ".ts": "typescript",\r
        ".rs": "rust",\r
        ".cpp": "cpp",\r
        ".c": "c",\r
        ".java": "java",\r
        ".rb": "ruby",\r
        ".sql": "sql",\r
    }\r
\r
    # 默认自动扫描脚本的目录\r
    DEFAULT_SCAN_DIRS: List[str] = ["scripts", "python"]\r
\r
    def __init__(self, root_dir: Path = PROJECT_ROOT) -> None:\r
        self.root_dir = root_dir\r
\r
    def export(\r
        self,\r
        explicit_scripts: Optional[Iterable[str]] = None,\r
        auto_scan: bool = True,\r
    ) -> None:\r
        """导出指定的脚本文件，或自动扫描支持的脚本生成 Markdown。"""\r
        target_files: Set[Path] = set()\r
\r
        # 1. 添加显式指定的文件\r
        if explicit_scripts:\r
            for rel_str in explicit_scripts:\r
                target_path = self.root_dir / rel_str\r
                if target_path.exists():\r
                    target_files.add(target_path)\r
                else:\r
                    print(f"[Warning] Specified script not found: {target_path}")\r
\r
        # 2. 自动扫描常规脚本目录中的代码文件\r
        if auto_scan:\r
            for folder_name in self.DEFAULT_SCAN_DIRS:\r
                folder_path = self.root_dir / folder_name\r
                if not folder_path.is_dir():\r
                    continue\r
                for file_path in folder_path.rglob("*"):\r
                    if (\r
                        file_path.is_file()\r
                        and file_path.suffix in self.LANGUAGE_MAP\r
                        and "__pycache__" not in file_path.parts\r
                    ):\r
                        target_files.add(file_path)\r
\r
        # 3. 执行转换\r
        for script_file in sorted(target_files):\r
            self._convert_single_script(script_file)\r
\r
    def _convert_single_script(self, script_path: Path) -> None:\r
        try:\r
            code_content = script_path.read_text(encoding="utf-8")\r
        except UnicodeDecodeError:\r
            print(f"[Error] Failed to read text from {script_path}, skipping.")\r
            return\r
\r
        lang = self.LANGUAGE_MAP.get(script_path.suffix, "")\r
        md_file = script_path.with_suffix(".md")\r
\r
        md_content = f"\`\`\`{lang}\\n{code_content}\\n\`\`\`\\n"\r
        md_file.write_text(md_content, encoding="utf-8")\r
        print(f"[Exported] {script_path.name} -> {md_file.name}")\r
\r
\r
if __name__ == "__main__":\r
    # 编译React简历页面，同步产物\r
    ReactAboutBuilder().build_and_sync()\r
\r
    # 生成并覆盖导航菜单（自动带上About Me链接）\r
    SiteIndexBuilder().build_and_overwrite()\r
\r
    # 智能导出脚本为 Markdown\r
    ScriptMarkdownExporter().export()\r
\r
\`\`\`\r
`});function t(){return Object.entries(e).map(([e,t])=>{let n=e.endsWith(`.html`),r=e.replace(/^\/raw-docs\//,``).replace(/\.(md|markdown|html)$/,``),i=r;if(n){let e=t.match(/<title[^>]*>([^<]+)<\/title>/i);e&&(i=e[1].trim())}else{let e=(t.trim().split(`
`)[0]||``).match(/^#\s+(.+)$/);e&&(i=e[1].trim())}return{slug:r,filePath:e,title:i,rawContent:t,type:n?`html`:`md`}}).sort((e,t)=>e.title.localeCompare(t.title,`en-US`))}function n(e){return t().find(t=>t.slug===e)}export{t as n,n as t};