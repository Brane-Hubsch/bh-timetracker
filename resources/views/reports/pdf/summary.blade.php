@extends('reports.pdf.layout', ['groupingLabel' => $subGrouping ? $grouping->label().' › '.$subGrouping->label() : $grouping->label()])

@section('content')
    @include('reports.pdf.stats', ['totals' => $summary['totals']])

    @if ($summary['totals']['seconds'] > 0)
        @include('reports.pdf.timeline-chart', ['chart' => $timeline, 'width' => 182, 'height' => 36])
        @include('reports.pdf.project-chart', ['projects' => $projectShares])
    @endif

    @if ($summary['groups'] === [])
        <p class="empty">{{ __('No time in this period.') }}</p>
    @else
        <table class="data">
            <thead>
                <tr>
                    <th>{{ $grouping->label() }}{{ $subGrouping ? ' / '.$subGrouping->label() : '' }}</th>
                    <th class="num">{{ __('Hours') }}</th>
                    <th class="num">{{ __('Billable hours') }}</th>
                    @if ($showAmounts)
                        <th class="num">{{ __('Amount') }}</th>
                    @endif
                </tr>
            </thead>
            <tbody>
                @foreach ($summary['groups'] as $group)
                    <tr @class(['group' => $subGrouping !== null])>
                        <td class="name">
                            @if ($group['color'])<span class="dot" style="background: {{ $group['color'] }};"></span>@endif{{ $group['label'] }}
                        </td>
                        <td class="num">{{ $hours($group['seconds']) }}</td>
                        <td class="num">{{ $hours($group['billableSeconds']) }}</td>
                        @if ($showAmounts)
                            <td class="num">{{ $money($group['amount']) }}</td>
                        @endif
                    </tr>
                    @if ($subGrouping)
                        @foreach ($group['children'] as $child)
                            <tr class="child">
                                <td class="name">
                                    @if ($child['color'])<span class="dot" style="background: {{ $child['color'] }};"></span>@endif{{ $child['label'] }}
                                </td>
                                <td class="num">{{ $hours($child['seconds']) }}</td>
                                <td class="num">{{ $hours($child['billableSeconds']) }}</td>
                                @if ($showAmounts)
                                    <td class="num">{{ $money($child['amount']) }}</td>
                                @endif
                            </tr>
                        @endforeach
                    @endif
                @endforeach
                @if ($grouping === \App\Enums\ReportGrouping::Tag || $subGrouping === \App\Enums\ReportGrouping::Tag)
                    <tr>
                        <td colspan="{{ $showAmounts ? 4 : 3 }}" class="muted small" style="border-bottom: 0;">{{ __('An entry with several tags counts under each of them, so the tags can add up to more than the total.') }}</td>
                    </tr>
                @endif
                <tr class="total">
                    <td>{{ __('Total') }}</td>
                    <td class="num">{{ $hours($summary['totals']['seconds']) }}</td>
                    <td class="num">{{ $hours($summary['totals']['billableSeconds']) }}</td>
                    @if ($showAmounts)
                        <td class="num">{{ $money($summary['totals']['amount']) }}</td>
                    @endif
                </tr>
            </tbody>
        </table>
    @endif
@endsection
