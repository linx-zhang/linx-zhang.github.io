
# Get the keys of all levels above the base type

```python

data = {
    "k1": {"k1": {"k1": 1, "k2": 2}},
    "k2": {"k1": {"k1": 3, "k2": {"k1": 4, "k2": 5}}},
    "k3": {"k1": {"k1": {"k1": 6, "k2": 7}}},
    "k4": {"k1": 8, "k2": 9},
}

flat_res = {}
has_data_keys = set()


def flat_dict(dictionary, keys=None):
    for k, v in dictionary.items():
        local_k = (keys[:] + [k]) if keys is not None else [k]
        if isinstance(v, dict):
            flat_dict(v, local_k)
        else:
            flat_res[tuple(local_k)] = v
            has_data_keys.add(tuple(keys))


flat_dict(data)

```

## TestCase & OutPut

```python

from pprint import pprint

pprint(flat_res)
# Out
"""
{
('k1', 'k1', 'k1'): 1,
('k1', 'k1', 'k2'): 2,
('k2', 'k1', 'k1'): 3,
('k2', 'k1', 'k2', 'k1'): 4,
('k2', 'k1', 'k2', 'k2'): 5,
('k3', 'k1', 'k1', 'k1'): 6,
('k3', 'k1', 'k1', 'k2'): 7,
('k4', 'k1'): 8,
('k4', 'k2'): 9
}
"""

pprint(has_data_keys)
# Out
"""
{('k2', 'k1', 'k2'), ('k4',), ('k1', 'k1'), ('k2', 'k1'), ('k3', 'k1', 'k1')}
"""


# k1, k3 Single Key
def f(top_k):
    pprint({"--".join(k): v for k, v in flat_res.items() if k[0] == top_k})


f("k1")
# Out
"""
{'k1--k1--k1': 1, 'k1--k1--k2': 2}
"""

f("k3")
# Out
"""
{'k3--k1--k1--k1': 6, 'k3--k1--k1--k2': 7}
"""

f("k2")
# Out
"""
{'k2--k1--k1': 3, 'k2--k1--k2--k1': 4, 'k2--k1--k2--k2': 5}
"""

f("k4")
# Out
"""
{'k4--k1': 8, 'k4--k2': 9}
"""

```