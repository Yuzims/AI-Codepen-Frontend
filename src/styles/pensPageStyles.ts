import styled from "@emotion/styled";
import { Link } from "react-router-dom";

export const PageContainer = styled.div`
  min-height: 100vh;
  background: #f8f9fa;
`;

export const Container = styled.div`
  padding: 20px;
  max-width: 1200px;
  margin: 0 auto;
  height: 100vh;
  display: flex;
  flex-direction: column;
`;

export const Header = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 30px;
  flex-shrink: 0;
  gap: 16px;
  flex-wrap: wrap;
`;

export const Title = styled.h1`
  margin: 0;
  color: #333;
  font-size: 2rem;
`;

export const HeaderActions = styled.div`
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
`;

export const CreateButton = styled(Link)`
  padding: 12px 24px;
  background: linear-gradient(45deg, #667eea, #764ba2);
  color: white;
  text-decoration: none;
  border-radius: 8px;
  font-weight: 500;
  transition: all 0.2s ease;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);

  &:hover {
    transform: translateY(-2px);
    box-shadow: 0 4px 8px rgba(0, 0, 0, 0.15);
  }
`;

export const SecondaryActionButton = styled.button`
  padding: 12px 24px;
  background: #ffffff;
  color: #5a5fcf;
  border: 1px solid rgba(102, 126, 234, 0.35);
  border-radius: 8px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s ease;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);

  &:hover {
    transform: translateY(-2px);
    box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1);
    background: #f8f8ff;
  }
`;

export const PenGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
  gap: 24px;
  margin-top: 20px;
  flex: 1;
  overflow-y: auto;
  padding-right: 8px;

  &::-webkit-scrollbar {
    width: 8px;
  }

  &::-webkit-scrollbar-track {
    background: #f1f1f1;
    border-radius: 4px;
  }

  &::-webkit-scrollbar-thumb {
    background: #c1c1c1;
    border-radius: 4px;
  }

  &::-webkit-scrollbar-thumb:hover {
    background: #a8a8a8;
  }
`;

export const PenCard = styled(Link)`
  position: relative;
  display: flex;
  flex-direction: column;
  padding: 20px;
  background: white;
  border-radius: 8px;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
  text-decoration: none;
  color: inherit;
  transition: transform 0.2s, box-shadow 0.2s;
  height: 200px;

  &:hover {
    transform: translateY(-2px);
    box-shadow: 0 4px 8px rgba(0, 0, 0, 0.15);
  }
`;

export const ShareButton = styled.button`
  position: absolute;
  top: 12px;
  right: 12px;
  background: #4caf50;
  color: white;
  border: none;
  border-radius: 4px;
  padding: 6px 12px;
  font-size: 14px;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 4px;
  transition: background-color 0.2s;

  &:hover {
    background: #45a049;
  }
`;

export const Toast = styled.div`
  position: fixed;
  bottom: 20px;
  left: 50%;
  transform: translateX(-50%);
  background: rgba(0, 0, 0, 0.8);
  color: white;
  padding: 12px 24px;
  border-radius: 4px;
  font-size: 14px;
  z-index: 1000;
  animation: fadeInOut 2s ease-in-out;

  @keyframes fadeInOut {
    0% {
      opacity: 0;
    }
    15% {
      opacity: 1;
    }
    85% {
      opacity: 1;
    }
    100% {
      opacity: 0;
    }
  }
`;

export const PenTitle = styled.h3`
  margin: 0 0 12px 0;
  color: #333;
  font-size: 1.2rem;
  font-weight: 600;
`;

export const PenDescription = styled.p`
  margin: 0 0 16px 0;
  color: #666;
  font-size: 0.9rem;
  line-height: 1.5;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
`;

export const PenMeta = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: auto;
  padding-top: 12px;
  border-top: 1px solid #f0f0f0;
`;

export const PenDate = styled.div`
  color: #999;
  font-size: 0.8rem;
`;

export const PenStatus = styled.div<{ isPublic: boolean }>`
  padding: 4px 8px;
  border-radius: 12px;
  font-size: 0.7rem;
  font-weight: 500;
  background: ${(props) => (props.isPublic ? "#e8f5e8" : "#fff3cd")};
  color: ${(props) => (props.isPublic ? "#2d7738" : "#856404")};
`;

export const EmptyState = styled.div`
  text-align: center;
  padding: 60px 20px;
  color: #666;
`;

export const EmptyIcon = styled.div`
  font-size: 4rem;
  margin-bottom: 16px;
`;

export const EmptyTitle = styled.h3`
  margin: 0 0 8px 0;
  color: #333;
`;

export const EmptyText = styled.p`
  margin: 0 0 24px 0;
  color: #666;
`;

export const EmptyActions = styled.div`
  display: flex;
  justify-content: center;
  gap: 12px;
  flex-wrap: wrap;
`;
