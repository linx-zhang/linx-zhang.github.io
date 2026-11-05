import hashlib
import json
import time


class Db:
    key = "key-jdiqwojaf"
    secret = "secret-pskdfhsjfhsfhjk"
    key_secret = {key: secret}

    last_sign = ""

    @classmethod
    def get(cls, k):
        return cls.secret


def h256(data: str):
    b_data = data.encode(encoding="utf-8")
    hash_object = hashlib.sha256()
    hash_object.update(b_data)
    hash_value = hash_object.hexdigest()

    print("SHA-256 Hash Value:", hash_value)
    return hash_value


def sender(data: dict):
    data.update(
        key=Db.key,
        timestamp=int(time.time() * 1000),
    )
    sorted_data = {k: data[k] for k in sorted(data)}
    hash_str = json.dumps(sorted_data) + Db.secret
    return {
        **sorted_data,
        "sign": h256(hash_str),
    }


def receiver(data: dict):
    sign = data.pop("sign", None)
    timestamp = data.get("timestamp")
    # key enable
    secret = Db.get(data.get("key"))

    if time.time() * 1000 - timestamp > 5000:
        raise TimeoutError("sign timeout 5s")
    sorted_data = {k: data[k] for k in sorted(data)}
    hash_str = json.dumps(sorted_data) + secret
    if sign != h256(hash_str):
        raise ValueError("sign err")


d = {}

receiver(sender(d))
