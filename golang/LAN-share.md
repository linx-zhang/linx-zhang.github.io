
# Local Area Net Share local-file Script

- [LAN_Share.zip (win-x86-64)](https://github.com/linx-zhang/static/blob/main/tools/LAN_Share.zip)
- If you have a python environment, `python -m http.server 59999`
- Effect

<a target="_blank" href="http://m.qpic.cn/psc?/V52HCgKy0b7Yhv1a5Lcc2Cuwq53oINm3/ruAMsa53pVQWN7FLK88i5p5G3odP31egXDVQ2Ti9gyMPUn3rQMmOWPMMeJC5WXSnXgps*0Cklsya*ETJKZMl6LbYiOrClWSG3fw1m9vbfFo!/b&bo=2wUgAwAAAAADB98!&rf=viewer_4">
<img title="Click If No Picture" src="https://github.com/linx-zhang/static/blob/main/tools/LAN_Share20230602142355.png?raw=true">
</a>

- Source code

```golang
import (
	"flag"
	"fmt"
	"log"
	"net"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"time"
)

func Server() {
	// Faker-Connection -> addr
	conn, err := net.Dial("udp", "8.8.8.8:53")
	if err != nil {
		log.Println(err)
		return
	}
	localAddr := conn.LocalAddr().(*net.UDPAddr).String()
	localAddr = strings.Split(localAddr, ":")[0]
	log.Printf("\nLocal ip address: %s", localAddr)
	// Shared folder
	defaultSharePath, _ := filepath.Abs(filepath.Dir(os.Args[0]))
	fmt.Println("Default Share Path:", defaultSharePath)

	var folder, port string
	type MsgVarDefault struct {
		msg          string
		strPtr       *string
		defaultValue string
	}
	var msgVarDefault = []*MsgVarDefault{
		{`Setting share folder path(Press enter use default): `, &folder, defaultSharePath},
		{`Setting port: `, &port, "59999"},
	}
	for _, obj := range msgVarDefault {
		fmt.Print(obj.msg)
		fmt.Scanln(obj.strPtr)
		if *obj.strPtr == "" {
			*obj.strPtr = obj.defaultValue
		}
	}

	// Server start
	var (
		listen = flag.String("listen", ":"+port, "listen address")
		dir    = flag.String("dir", folder, "directory to serve")
	)
	log.Printf("share %s, listening on http://%s%s...", *dir, localAddr, *listen)
	err = http.ListenAndServe(*listen, http.FileServer(http.Dir(*dir)))
	log.Println(err)
	time.Sleep(time.Second * 300)
}

func main() {
	Server()
}

```