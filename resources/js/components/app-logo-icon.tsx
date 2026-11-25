import appLogo from '../../../public/favicon.svg';

export default function AppLogoIcon({ size }: { size: number }) {
    return (
        <img
            src={appLogo}
            alt=""
            width={size}
            height={size}
            className="shrink-0"
        />
    );
}
