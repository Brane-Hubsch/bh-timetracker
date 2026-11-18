import { Button, Dropdown, Label } from '@heroui/react';
import { Download } from 'lucide-react';
import { useTranslation } from '@/lib/i18n';
import { reportQuery } from '@/lib/reports';
import { exportMethod } from '@/routes/reports';
import type { ReportFilterValues } from '@/types';

type Props = {
    type: 'summary' | 'detailed';
    filters: ReportFilterValues;
};

/**
 * Download the current report (same filters) as CSV or XLSX.
 */
export function ExportMenu({ type, filters }: Props) {
    const { t } = useTranslation();
    const url = (format: 'csv' | 'xlsx') =>
        exportMethod.url(undefined, {
            query: { ...reportQuery(filters), type, format },
        });

    return (
        <Dropdown>
            <Button variant="secondary" data-test="report-export">
                <Download className="size-4" />
                {t('Export')}
            </Button>
            <Dropdown.Popover placement="bottom end" className="min-w-48">
                <Dropdown.Menu
                    onAction={(key) => {
                        window.location.href = url(key as 'csv' | 'xlsx');
                    }}
                >
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
