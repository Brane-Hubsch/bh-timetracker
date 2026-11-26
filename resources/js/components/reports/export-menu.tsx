import { Button, Dropdown, Label } from '@heroui/react';
import { Download } from 'lucide-react';
import { useTranslation } from '@/lib/i18n';
import { reportQuery } from '@/lib/reports';
import { exportMethod } from '@/routes/reports';
import type { ReportFilterValues } from '@/types';

type Props = {
    type: 'summary' | 'detailed';
    filters: ReportFilterValues;
    mobile?: boolean;
};

type Format = 'csv' | 'xlsx' | 'pdf';

/**
 * Download the current report (same filters) as PDF, XLSX or CSV.
 */
export function ExportMenu({ type, filters, mobile = false }: Props) {
    const { t } = useTranslation();
    const url = (format: Format) =>
        exportMethod.url(undefined, {
            query: { ...reportQuery(filters), type, format },
        });

    return (
        <Dropdown>
            <Button
                variant={mobile ? 'outline' : 'secondary'}
                className={
                    mobile
                        ? 'h-10 w-full rounded-full border-border bg-surface'
                        : undefined
                }
                data-test={mobile ? 'mobile-report-export' : 'report-export'}
            >
                <Download className="size-4" />
                {t('Export')}
            </Button>
            <Dropdown.Popover
                placement={mobile ? 'top' : 'bottom end'}
                className="min-w-48"
            >
                <Dropdown.Menu
                    onAction={(key) => {
                        window.location.href = url(key as Format);
                    }}
                >
                    <Dropdown.Item id="pdf" textValue="PDF">
                        <Label>PDF</Label>
                    </Dropdown.Item>
                    <Dropdown.Item id="xlsx" textValue="Excel (XLSX)">
                        <Label>Excel (XLSX)</Label>
                    </Dropdown.Item>
                    <Dropdown.Item id="csv" textValue="CSV">
                        <Label>CSV</Label>
                    </Dropdown.Item>
                </Dropdown.Menu>
            </Dropdown.Popover>
        </Dropdown>
    );
}
