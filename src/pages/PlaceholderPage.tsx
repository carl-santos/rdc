import DashboardLayout from '../layouts/DashboardLayout';

const PlaceholderPage = ({ title }: { title: string }) => {
    return (
        <DashboardLayout title={title}>
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-12 text-center">
                <div className="size-20 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-6">
                    <span className="material-symbols-outlined text-primary text-4xl">construction</span>
                </div>
                <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">Em Construção</h2>
                <p className="text-slate-500 max-w-sm mx-auto">
                    Estamos trabalhando nesta funcionalidade. Em breve você poderá gerenciar {title.toLowerCase()} aqui.
                </p>
            </div>
        </DashboardLayout>
    );
};

export default PlaceholderPage;
