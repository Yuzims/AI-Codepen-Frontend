import styled from '@emotion/styled';

export const NavbarContainer = styled.div`
    background: #fff;
    border-bottom: 1px solid #e0e0e0;
    padding: 0 20px;
    position: sticky;
    top: 0;
    z-index: 1000;
    box-shadow: 0 2px 4px rgba(0,0,0,0.1);
`;

export const NavbarContent = styled.div`
    max-width: 1200px;
    margin: 0 auto;
    display: flex;
    justify-content: space-between;
    align-items: center;
    height: 60px;
`;

export const Logo = styled.div`
    font-size: 1.5rem;
    font-weight: bold;
    color: #333;
    cursor: pointer;
    display: flex;
    align-items: center;
    gap: 8px;
    
    &:hover {
        color: #0066cc;
    }
`;

export const UserSection = styled.div`
    display: flex;
    align-items: center;
    gap: 16px;
`;

export const UserInfo = styled.div`
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px 12px;
    background: #f8f9fa;
    border-radius: 20px;
    font-size: 0.9rem;
    color: #666;
`;

export const UserAvatar = styled.div`
    width: 32px;
    height: 32px;
    border-radius: 50%;
    background: linear-gradient(45deg, #667eea, #764ba2);
    display: flex;
    align-items: center;
    justify-content: center;
    color: white;
    font-weight: bold;
    font-size: 0.9rem;
`;

export const Username = styled.span`
    font-weight: 500;
    color: #333;
`;

export const LogoutButton = styled.button`
    padding: 8px 16px;
    background: #fff;
    color: #666;
    border: 1px solid #ddd;
    border-radius: 4px;
    cursor: pointer;
    font-size: 0.9rem;
    transition: all 0.2s ease;
    
    &:hover {
        background: #f8f9fa;
        border-color: #bbb;
        color: #333;
    }
    
    &:active {
        transform: translateY(1px);
    }
`;

export const LoadingSpinner = styled.div`
    width: 20px;
    height: 20px;
    border: 2px solid #f3f3f3;
    border-top: 2px solid #666;
    border-radius: 50%;
    animation: spin 1s linear infinite;
    
    @keyframes spin {
        0% { transform: rotate(0deg); }
        100% { transform: rotate(360deg); }
    }
`; 