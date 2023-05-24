# Generate has timestamp id

- The timestamp can be restored by id
- Does not expose timestamp
- The probability of duplicate id generated per second is `1 / (1<<rand_bit_num)` 

```golang
import (
	"crypto/rand"
	"fmt"
	"math/big"
	"time"
)

const (
	// Set any milliseconds timestamp 
	time_const   = 1657009310393
	// Random number bits
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
	fmt.Println("Database saved ID:", id)

	// Reset id to timestamp
	rsh_id := bigMath.Rsh(id, rand_bit_num)
	fmt.Println(bigMath.Add(rsh_id, big.NewInt(time_const)))

}
```
