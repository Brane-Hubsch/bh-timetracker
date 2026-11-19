@php($statWidth = $showAmounts ? '32%' : '49%')
<table class="stats">
    <tr>
        <td class="stat" style="width: {{ $statWidth }};"><div class="muted">{{ __('Hours') }}</div><div class="value">{{ $hours($totals['seconds']) }}</div></td>
        <td class="gap" style="width: 2%;"></td>
        <td class="stat" style="width: {{ $statWidth }};"><div class="muted">{{ __('Billable hours') }}</div><div class="value">{{ $hours($totals['billableSeconds']) }}</div></td>
        @if ($showAmounts)
            <td class="gap" style="width: 2%;"></td>
            <td class="stat" style="width: {{ $statWidth }};"><div class="muted">{{ __('Amount') }}</div><div class="value">{{ $money($totals['amount']) }}</div></td>
        @endif
    </tr>
</table>
