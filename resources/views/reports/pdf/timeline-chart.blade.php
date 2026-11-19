{{--
    Hours per day/week as columns. $width and $height are the chart size in mm; the plot sits right
    of a 10 mm gutter for the hour ticks. dompdf has no flexbox, so the gridlines are absolutely
    positioned and the bars are table cells aligned to the baseline.
--}}
@php
    $gutter = 10;
    $plotWidth = $width - $gutter;
    $slot = count($chart['bars']) > 0 ? $plotWidth / count($chart['bars']) : $plotWidth;
    $barWidth = min(6, $slot * 0.62);
@endphp
<div class="chart">
    <div class="chart-title">{{ $chart['title'] }}</div>
    <div style="position: relative; height: {{ $height }}mm; width: {{ $width }}mm;">
        @foreach ($chart['ticks'] as $tick)
            @php($bottom = $tick / $chart['max'] * $height)
            <div class="gridline{{ $tick === 0 ? ' baseline' : '' }}" style="bottom: {{ $bottom }}mm; left: {{ $gutter }}mm; width: {{ $plotWidth }}mm;"></div>
            <div class="tick" style="bottom: {{ $bottom - 1.3 }}mm; width: {{ $gutter - 2 }}mm;">{{ $tick }} h</div>
        @endforeach
        <table class="columns" style="left: {{ $gutter }}mm; width: {{ $plotWidth }}mm; height: {{ $height }}mm;">
            <tr>
                @foreach ($chart['bars'] as $bar)
                    <td style="height: {{ $height }}mm;">
                        @if ($bar['ratio'] > 0)
                            <div class="column" style="width: {{ $barWidth }}mm; height: {{ max(0.4, $bar['ratio'] * $height) }}mm;"></div>
                        @endif
                    </td>
                @endforeach
            </tr>
        </table>
    </div>
    <table class="column-labels" style="margin-left: {{ $gutter }}mm; width: {{ $plotWidth }}mm;">
        <tr>
            @foreach ($chart['bars'] as $bar)
                <td>{{ $bar['label'] }}</td>
            @endforeach
        </tr>
    </table>
</div>
