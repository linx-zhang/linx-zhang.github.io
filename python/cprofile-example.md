```python
import cProfile
import pstats
import io
from django.conf import settings
from django.http import HttpResponse


class ProfileMiddleware:
    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        # 只对特定视图启用性能分析
        if 'myalva/analysis' in request.path:
            pr = cProfile.Profile()
            pr.enable()

            response = self.get_response(request)

            pr.disable()
            s = io.StringIO()
            sortby = pstats.SortKey.CUMULATIVE
            ps = pstats.Stats(pr, stream=s).sort_stats(sortby)
            ps.print_stats()

            # 将统计信息写入响应或记录到文件
            print(s.getvalue())  # 或者写入日志文件

            return response
        else:
            return self.get_response(request)
```