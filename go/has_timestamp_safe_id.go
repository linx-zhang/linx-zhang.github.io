
import (
	"crypto/rand"
	"fmt"
	"math/big"
	"time"
)

const (
	time_const   = 1657009310393
	rand_bit_num = 23
)

var bigMath big.Int

func MakeId() *big.Int {
	randInt, _ := rand.Int(rand.Reader, big.NewInt(1<<rand_bit_num))

	bigT := big.NewInt(time.Now().UnixMilli() - time_const)

	return bigMath.Or(bigMath.Lsh(bigT, rand_bit_num), randInt)
}

func main() {
	id := MakeId()
	fmt.Println("Db saved ID :", id)

	// Reset id to timestamp
	rsh_id := bigMath.Rsh(id, rand_bit_num)
	fmt.Println(bigMath.Add(rsh_id, big.NewInt(time_const)))

}
