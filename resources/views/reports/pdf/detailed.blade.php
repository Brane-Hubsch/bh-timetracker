@extends('reports.pdf.layout')

@section('content')
    @include('reports.pdf.stats', ['totals' => $totals])

    @if ($totals['seconds'] === 0)
        <p class="empty">{{ __('No time in this period.') }}</p>
    @else
        <table class="data">
            <thead>
                <tr>
                    <th>{{ __('Date') }}</th>
                    <th>{{ __('Start') }}–{{ __('End') }}</th>
                    @if ($showMembers)
                        <th>{{ __('Member') }}</th>
                    @endif
                    <th>{{ __('Project') }}</th>
                    <th>{{ __('Description') }}</th>
                    <th class="num">{{ __('Hours') }}</th>
                    @if ($showAmounts)
                        <th class="num">{{ __('Amount') }}</th>
                    @endif
                </tr>
            </thead>
            <tbody>
                @foreach ($rows as $row)
                    <tr>
                        <td style="white-space: nowrap;">{{ $formatDate($row['date']) }}</td>
                        <td style="white-space: nowrap;">{{ substr($row['start'], 11) }}–{{ substr($row['end'], 11) }}</td>
                        @if ($showMembers)
                            <td>{{ $row['memberName'] }}</td>
                        @endif
                        <td>
                            <span class="dot" style="background: {{ $row['project']['color'] }};"></span>{{ $row['project']['name'] }}
                            @if ($row['project']['clientName'])
                                <div class="muted small">{{ $row['project']['clientName'] }}</div>
                            @endif
                        </td>
                        <td>{{ $row['description'] }}</td>
                        <td class="num">
                            {{ $hours($row['durationSeconds']) }}
                            @unless ($row['isBillable'])
                                <div class="muted small">{{ __('Not billable') }}</div>
                            @endunless
                        </td>
                        @if ($showAmounts)
                            <td class="num">{{ $row['isBillable'] ? $money($row['amount']) : '–' }}</td>
                        @endif
                    </tr>
                @endforeach
                <tr class="total">
                    <td colspan="{{ $showMembers ? 5 : 4 }}">{{ __('Total') }}</td>
                    <td class="num">{{ $hours($totals['seconds']) }}</td>
                    @if ($showAmounts)
                        <td class="num">{{ $money($totals['amount']) }}</td>
                    @endif
                </tr>
            </tbody>
        </table>
    @endif
@endsection
