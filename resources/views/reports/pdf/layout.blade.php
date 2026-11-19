{{-- Shared layout for report PDFs (rendered by dompdf: CSS 2.1, tables rather than flex/grid). --}}
<!DOCTYPE html>
<html lang="{{ app()->getLocale() }}">
<head>
    <meta charset="utf-8">
    <title>{{ $title }} – {{ $organization }}</title>
    <style>
        {{-- Inter, the app's typeface (resources/fonts/inter, SIL Open Font License). --}}
        @font-face { font-family: 'Inter'; font-weight: normal; font-style: normal; src: url('{{ resource_path('fonts/inter/Inter-Regular.ttf') }}') format('truetype'); }
        @font-face { font-family: 'Inter'; font-weight: bold; font-style: normal; src: url('{{ resource_path('fonts/inter/Inter-Bold.ttf') }}') format('truetype'); }
        @page { margin: 16mm 14mm 18mm; }
        body { font-family: 'Inter', 'DejaVu Sans', sans-serif; font-size: 8.5pt; line-height: 1.45; color: #18181b; }
        .muted { color: #71717a; }
        .header { margin-bottom: 6mm; }
        .brand { font-size: 7.5pt; letter-spacing: 0.06em; text-transform: uppercase; color: #7c3aed; font-weight: bold; }
        h1 { font-size: 17pt; margin: 1.5mm 0 1mm; font-weight: bold; }
        .period { font-size: 10pt; }
        .criteria { margin-top: 3mm; border-collapse: collapse; }
        .criteria td { padding: 0.6mm 4mm 0.6mm 0; vertical-align: top; }
        .criteria td.label { color: #71717a; white-space: nowrap; }
        .stats { width: 100%; border-collapse: collapse; table-layout: fixed; margin-bottom: 7mm; }
        .stats td.stat { background: #f4f4f5; border-radius: 2mm; padding: 3mm 3.5mm; }
        .stats .value { font-size: 14pt; font-weight: bold; margin-top: 0.5mm; }
        table.data { width: 100%; border-collapse: collapse; }
        table.data th { text-align: left; font-size: 7pt; text-transform: uppercase; letter-spacing: 0.05em; color: #71717a; font-weight: bold; padding: 0 2mm 2mm; border-bottom: 1px solid #d4d4d8; }
        table.data td { padding: 1.7mm 2mm; border-bottom: 1px solid #ececef; vertical-align: top; }
        table.data tr { page-break-inside: avoid; }
        table.data th.num, table.data td.num { text-align: right; white-space: nowrap; }
        table.data.compact { font-size: 7.5pt; }
        table.data.compact td { padding: 1.1mm 1.6mm; line-height: 1.3; }
        table.data.compact th { padding: 0 1.6mm 1.5mm; }
        tr.group td { font-weight: bold; background: #fafafa; }
        tr.child td.name { padding-left: 6mm; }
        tr.total td { font-weight: bold; border-top: 1.5px solid #18181b; border-bottom: 0; padding-top: 2.5mm; }
        .chart { margin-bottom: 6mm; page-break-inside: avoid; }
        .chart-title { font-weight: bold; font-size: 9pt; margin-bottom: 3mm; }
        .gridline { position: absolute; height: 0; border-top: 0.6px solid #ececef; }
        .gridline.baseline { border-top-color: #c4c4cc; }
        .tick { position: absolute; left: 0; text-align: right; font-size: 6.5pt; color: #71717a; }
        table.columns { position: absolute; top: 0; border-collapse: collapse; table-layout: fixed; }
        table.columns td { vertical-align: bottom; padding: 0; text-align: center; }
        .column { margin: 0 auto; background: #7c3aed; border-radius: 0.8mm 0.8mm 0 0; }
        table.column-labels { border-collapse: collapse; table-layout: fixed; margin-top: 1.2mm; }
        table.column-labels td { padding: 0; text-align: center; font-size: 6.5pt; color: #71717a; white-space: nowrap; }
        table.hbars { width: 100%; border-collapse: collapse; }
        table.hbars td { padding: 1.1mm 0; vertical-align: middle; }
        td.hbar-label { width: 34%; padding-right: 3mm; }
        td.hbar-track { width: 48%; }
        td.hbar-value { width: 18%; text-align: right; white-space: nowrap; padding-left: 3mm; }
        .hbar { height: 2.6mm; border-radius: 0 0.8mm 0.8mm 0; }
        .dot { display: inline-block; width: 2.2mm; height: 2.2mm; border-radius: 1.1mm; margin-right: 1.5mm; }
        .small { font-size: 7.5pt; }
        .empty { padding: 8mm 0; text-align: center; color: #71717a; }
        .footer { position: fixed; bottom: -11mm; left: 0; right: 0; font-size: 7pt; color: #71717a; }
    </style>
</head>
<body>
    <div class="footer">
        {{-- Page numbers are drawn by ReportExporter::pdf(). --}}
        {{ $generated }}
    </div>

    <div class="header">
        <div class="brand">{{ $organization }}</div>
        <h1>{{ $title }}</h1>
        <div class="period">{{ $period }}</div>
        @if ($criteria !== [] || isset($groupingLabel))
            <table class="criteria">
                @isset($groupingLabel)
                    <tr><td class="label">{{ __('Group by') }}</td><td>{{ $groupingLabel }}</td></tr>
                @endisset
                @foreach ($criteria as $criterion)
                    <tr><td class="label">{{ $criterion['label'] }}</td><td>{{ $criterion['value'] }}</td></tr>
                @endforeach
            </table>
        @endif
    </div>

    @yield('content')
</body>
</html>
