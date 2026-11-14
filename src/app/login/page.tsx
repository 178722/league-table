import { LoginForm } from '@/components/login/LoginForm';
import { CredentialsChangeDialog } from '@/components/login/CredentialsChangeDialog';

// A1. ログイン画面
export default function LoginPage() {
  return (
    <div className="flex flex-1 items-center justify-center p-4">
      <div className="w-full max-w-sm rounded-xl border bg-background p-8 shadow-sm">
        <h1 className="mb-6 text-center text-xl font-semibold">リーグ戦しようよ</h1>
        <LoginForm />
        <div className="mt-2">
          <CredentialsChangeDialog />
        </div>
      </div>
    </div>
  );
}
