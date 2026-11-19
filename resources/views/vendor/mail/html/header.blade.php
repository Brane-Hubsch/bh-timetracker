@props(['url'])
<tr>
<td class="header">
<a href="{{ $url }}" style="display: inline-block; color: #18181b; text-decoration: none;">
<img src="{{ asset('icon-192.png') }}" width="36" height="36" alt="" style="width: 36px; height: 36px; border-radius: 9px; vertical-align: middle; margin-right: 8px;">
<span style="vertical-align: middle;">{!! $slot !!}</span>
</a>
</td>
</tr>
