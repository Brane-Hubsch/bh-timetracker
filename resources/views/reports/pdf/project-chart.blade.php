{{-- Time per project as horizontal bars in the projects' own colours, each named and labelled. --}}
<div class="chart">
    <div class="chart-title">{{ __('Time per project') }}</div>
    <table class="hbars">
        @foreach ($projects as $project)
            <tr>
                <td class="hbar-label">
                    <span class="dot" style="background: {{ $project['color'] }};"></span>{{ $project['name'] }}@if ($project['clientName'])<span class="muted"> · {{ $project['clientName'] }}</span>@endif
                </td>
                <td class="hbar-track">
                    <div class="hbar" style="width: {{ max(0.5, $project['ratio'] * 100) }}%; background: {{ $project['color'] }};"></div>
                </td>
                <td class="hbar-value">{{ $hours($project['seconds']) }} <span class="muted">{{ $project['percent'] }} %</span></td>
            </tr>
        @endforeach
    </table>
</div>
