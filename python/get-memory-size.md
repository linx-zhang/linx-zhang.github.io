
# Get memory sizeof | python

- Pympler
  - [Pympler pypi](https://pypi.org/project/Pympler/#description)
  - e.g.

  ```python
  from pympler import asizeof
  a = GenMenu()
  a.overwrite()
  print(asizeof.asizeof(a))
  # Out: 29352
  ```

- objsize
  - [objsize pypi](https://pypi.org/project/objsize/#description)
  - e.g.

  ```python
  from objsize import get_deep_size
  a = GenMenu()
  a.overwrite()
  print(get_deep_size(a))
  # Out: 28990
  ```


- Use sys.getsizeof() if you DON'T want to include sizes of linked (nested) objects:

```python
import sys
sys.getsizeof([1,2,3])
# Out: 120
```

- However, if you want to count sub-objects nested in lists, dicts, sets, tuples - and usually THIS is what you're looking for - use the recursive deep sizeof() function as shown below:

```python
import sys
def sizeof(obj):
    size = sys.getsizeof(obj)
    if isinstance(obj, dict): return size + sum(map(sizeof, obj.keys())) + sum(map(sizeof, obj.values()))
    if isinstance(obj, (list, tuple, set, frozenset)): return size + sum(map(sizeof, obj))
    return size
```